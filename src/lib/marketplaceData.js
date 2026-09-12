"use client";

// Couche de données de la Marketplace.
//
// Elle remplace le localStorage du prototype. Trois responsabilités, isolées
// ici pour que l'interface n'ait plus à les connaître :
//   * compresser une photo AVANT l'envoi ;
//   * la déposer dans le bucket marketplace-photos ;
//   * lire et écrire boutiques et articles.
//
// Le fichier est volontairement séparé du composant : l'interface change
// souvent, ces règles non — et deux sessions peuvent y travailler sans se
// marcher dessus.

import { supabase } from "@/lib/supabase";

export const BUCKET = "marketplace-photos";

/**
 * Échappe le texte fourni par un vendeur (nom de boutique, quartier) avant
 * de l'insérer dans un fragment HTML brut.
 *
 * Les cartes Leaflet (CarteBoutiques, GlobeExplorateurBoutiques)
 * construisent leurs tooltips/marqueurs via des
 * template strings passées directement à `bindTooltip`/`L.divIcon({ html })`
 * — ces API injectent le texte en HTML brut (innerHTML), pas en texte. Un
 * nom de boutique saisi comme `<img src=x onerror=...>` s'exécuterait donc
 * dans le navigateur de tout acheteur ouvrant la carte : faille XSS stockée,
 * atteignable en libre-service via la création de boutique. Confirmé le
 * 2026-09-08 lors d'un audit du Marketplace.
 */
export function echapperHtml(texte) {
  return String(texte ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

/**
 * Une coordonnée absente doit ressortir `null`, jamais 0.
 *
 * `Number(null)` vaut 0, et 0 passe `Number.isFinite` sans broncher. Écrite
 * telle quelle, une boutique sans relevé GPS serait enregistrée à la latitude
 * 0, longitude 0 — dans le golfe de Guinée, donc absente de toute recherche
 * de proximité, sans qu'aucune erreur ne soit levée. Le même piège avait déjà
 * étiré la carte d'itinéraire sur toute l'Afrique de l'Ouest.
 */
export function coordonnee(valeur) {
  if (valeur === null || valeur === undefined || valeur === "") return null;
  const n = Number(valeur);
  return Number.isFinite(n) ? n : null;
}

// Le plafond du bucket est de 2 Mo, imposé par Storage. On vise dix fois moins :
// à Dakar, une bonne partie du trafic passe par une 3G facturée au mégaoctet,
// et une annonce de six photos non compressées coûterait à chaque personne qui
// fait défiler la liste.
const LARGEUR_MAX = 1280;
const QUALITE = 0.72;
const POIDS_VISE = 220 * 1024;

/**
 * Réduit une image côté navigateur et renvoie un Blob JPEG.
 *
 * Passe par un canvas plutôt que par une bibliothèque : la compression est un
 * redimensionnement plus un ré-encodage, le navigateur sait faire les deux, et
 * une dépendance de plus serait chargée par tout le monde pour servir les seuls
 * vendeurs.
 *
 * @param {File} fichier image choisie par le vendeur
 * @returns {Promise<Blob>} image compressée
 */
export async function compresserImage(fichier) {
  if (!(fichier instanceof Blob)) {
    throw new Error("Fichier invalide.");
  }
  if (!fichier.type.startsWith("image/")) {
    throw new Error("Ce fichier n'est pas une image.");
  }

  // createImageBitmap décode hors du fil principal : sur un téléphone d'entrée
  // de gamme, décoder une photo de 12 Mpx avec <img> fige l'interface une
  // seconde ou deux, et la personne croit que l'application a planté.
  const bitmap = await createImageBitmap(fichier);

  const ratio = Math.min(1, LARGEUR_MAX / Math.max(bitmap.width, bitmap.height));
  const largeur = Math.round(bitmap.width * ratio);
  const hauteur = Math.round(bitmap.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = largeur;
  canvas.height = hauteur;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, largeur, hauteur);
  bitmap.close?.();

  let qualite = QUALITE;
  let blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", qualite));

  // Une photo très détaillée peut rester lourde après un seul passage. On
  // rabote la qualité au plus trois fois — au-delà, l'image devient laide sans
  // gagner grand-chose, et mieux vaut envoyer un fichier un peu plus gros.
  let essais = 0;
  while (blob && blob.size > POIDS_VISE && qualite > 0.4 && essais < 3) {
    qualite -= 0.12;
    essais += 1;
    blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", qualite));
  }

  if (!blob) throw new Error("La compression de l'image a échoué.");
  return blob;
}

/**
 * Dépose une photo compressée et renvoie son chemin dans le bucket.
 *
 * Le chemin commence TOUJOURS par l'identifiant du vendeur : la policy Storage
 * l'exige (voir migration 20260901190000). Sans ce préfixe, l'envoi est rejeté
 * — c'est ce qui empêche d'écraser la photo d'un concurrent.
 */
export async function envoyerPhoto(fichier, userId) {
  if (!userId) throw new Error("Connexion requise pour publier une photo.");

  const blob = await compresserImage(fichier);
  const nom = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

  const { error } = await supabase.storage.from(BUCKET).upload(nom, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error(`Envoi de la photo impossible : ${error.message}`);

  return nom;
}

/**
 * URL publique d'une photo. Le bucket est public en lecture : pas d'URL signée,
 * donc pas d'aller-retour supplémentaire pour afficher une vignette.
 */
export function urlPhoto(chemin) {
  if (!chemin) return null;
  if (typeof chemin === "string" && (chemin.startsWith("http://") || chemin.startsWith("https://") || chemin.startsWith("data:"))) {
    return chemin;
  }
  return supabase.storage.from(BUCKET).getPublicUrl(chemin).data.publicUrl;
}

/** Supprime une photo devenue inutile. L'échec n'est pas bloquant : un fichier
 *  orphelin coûte quelques kilo-octets, une annonce perdue coûte une vente. */
export async function supprimerPhoto(chemin) {
  if (!chemin) return;
  await supabase.storage.from(BUCKET).remove([chemin]).catch(() => {});
}

// ---------------------------------------------------------------------------
// Département déduit d'un relevé
// ---------------------------------------------------------------------------
//
// Ces coordonnées ont servi un temps de REPLI : une boutique sans relevé GPS
// recevait le centre de sa ville. C'était une fausse bonne idée — toutes ces
// boutiques se retrouvaient au même point et l'acheteur marchait vers un
// endroit où il n'y a rien.
//
// Utilisées à l'envers, en revanche, elles rendent un vrai service : à partir
// d'un relevé réel, on déduit le département le plus proche et on remplit le
// menu à la place du commerçant. Il peut toujours corriger — un centre de
// département n'est qu'un point, et les frontières administratives ne sont
// pas des cercles.

const CENTRES_DEPARTEMENTS = {
  Dakar: { lat: 14.6928, lng: -17.4467 },
  Guédiawaye: { lat: 14.7708, lng: -17.3872 },
  Pikine: { lat: 14.7547, lng: -17.3997 },
  Rufisque: { lat: 14.7167, lng: -17.2667 },
  "Keur Massar": { lat: 14.7833, lng: -17.3167 },
  Thiès: { lat: 14.791, lng: -16.925 },
  Mbour: { lat: 14.422, lng: -16.963 },
  Tivaouane: { lat: 14.954, lng: -16.812 },
  Diourbel: { lat: 14.653, lng: -16.234 },
  Bambey: { lat: 14.7, lng: -16.45 },
  Mbacké: { lat: 14.79, lng: -15.9 },
  Touba: { lat: 14.864, lng: -15.875 },
  Fatick: { lat: 14.333, lng: -16.4 },
  Foundiougne: { lat: 14.133, lng: -16.467 },
  Gossas: { lat: 14.5, lng: -16.067 },
  Kaolack: { lat: 14.15, lng: -16.083 },
  Guinguinéo: { lat: 14.267, lng: -15.95 },
  "Nioro du Rip": { lat: 13.75, lng: -15.767 },
  Kaffrine: { lat: 14.105, lng: -15.542 },
  Birkelane: { lat: 14.133, lng: -15.75 },
  Koungheul: { lat: 13.983, lng: -14.8 },
  "Malem-Hodar": { lat: 14.1, lng: -15.3 },
  "Saint-Louis": { lat: 16.032, lng: -16.489 },
  Dagana: { lat: 16.517, lng: -15.5 },
  Podor: { lat: 16.65, lng: -14.967 },
  Louga: { lat: 15.618, lng: -16.224 },
  Kébémer: { lat: 15.367, lng: -16.45 },
  Linguère: { lat: 15.395, lng: -15.119 },
  Matam: { lat: 15.655, lng: -13.255 },
  Kanel: { lat: 15.483, lng: -13.167 },
  "Ranérou-Ferlo": { lat: 15.3, lng: -13.967 },
  Tambacounda: { lat: 13.768, lng: -13.667 },
  Bakel: { lat: 14.9, lng: -12.467 },
  Goudiry: { lat: 14.183, lng: -12.717 },
  Koumpentoum: { lat: 13.983, lng: -14.567 },
  Kédougou: { lat: 12.556, lng: -12.174 },
  Salémata: { lat: 12.633, lng: -12.817 },
  Saraya: { lat: 12.833, lng: -11.75 },
  Kolda: { lat: 12.883, lng: -14.95 },
  "Médina Yoro Foulah": { lat: 13.3, lng: -15.0 },
  Vélingara: { lat: 13.15, lng: -14.117 },
  Sédhiou: { lat: 12.708, lng: -15.556 },
  Bounkiling: { lat: 13.033, lng: -15.7 },
  Goudomp: { lat: 12.583, lng: -15.867 },
  Ziguinchor: { lat: 12.583, lng: -16.271 },
  Bignona: { lat: 12.81, lng: -16.23 },
  Oussouye: { lat: 12.483, lng: -16.55 },
};

/**
 * Département dont le centre est le plus proche d'un relevé.
 * @returns {{nom: string, ecartKm: number} | null}
 */
export function departementLePlusProche(latitude, longitude) {
  const lat = coordonnee(latitude);
  const lng = coordonnee(longitude);
  if (lat === null || lng === null) return null;

  let meilleur = null;
  for (const [nom, c] of Object.entries(CENTRES_DEPARTEMENTS)) {
    // Haversine, la même formule que côté base — un écart de méthode ferait
    // diverger l'affichage et le tri.
    const R = 6371;
    const dLat = ((c.lat - lat) * Math.PI) / 180;
    const dLng = ((c.lng - lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat * Math.PI) / 180) * Math.cos((c.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const ecartKm = 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
    if (!meilleur || ecartKm < meilleur.ecartKm) meilleur = { nom, ecartKm: Math.round(ecartKm) };
  }
  return meilleur;
}

// ---------------------------------------------------------------------------
// Boutique du vendeur
// ---------------------------------------------------------------------------

export async function chargerMesBoutiques(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("marketplace_stores")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Une boutique par son id, quel que soit son propriétaire — policy "boutiques
 * actives visibles de tous" (RLS), pas besoin d'être connecté. Sert à
 * restaurer la fiche boutique ouverte après un rechargement de page (voir
 * MarketplaceClient.jsx) quand la boutique ne fait pas partie des listes déjà
 * en mémoire (résultats de recherche, mes propres boutiques...).
 */
export async function obtenirBoutiqueParId(id) {
  if (!id) return null;
  const { data, error } = await supabase
    .from("marketplace_stores")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  return data || null;
}

/** Nombre de boutiques offertes avant l'option payante. */
export const BOUTIQUES_OFFERTES = 1;

/**
 * Crée ou met à jour la boutique. La position vient de la géolocalisation du
 * navigateur, saisie une seule fois : c'est elle qui permet ensuite de trier
 * tout le stock par proximité, sans jamais géolocaliser un article.
 */
export async function creerBoutique(userId, champs) {
  if (!userId) throw new Error("Connexion requise.");

  const nom = String(champs?.nom || "").trim();
  if (!nom) throw new Error("Le nom de la boutique est obligatoire.");

  // Écriture par fonction SECURITY DEFINER, jamais en direct : aucune table de
  // ce dépôt n'accorde UPDATE ou DELETE à `authenticated` (invariant 1).
  const { data, error } = await supabase.rpc("creer_ma_boutique", {
    p_nom: nom,
    p_quartier: champs?.quartier?.trim() || null,
    p_ville: champs?.ville?.trim() || null,
    p_whatsapp: normaliserWhatsapp(champs?.telephone_whatsapp),
    p_lat: coordonnee(champs?.latitude),
    p_lng: coordonnee(champs?.longitude),
    // Précision annoncée par l'appareil. Conservée pour pouvoir expliquer plus
    // tard une boutique mal placée : un relevé à 800 m n'a pas la même valeur
    // qu'un relevé à 12 m.
    p_precision_m: coordonnee(champs?.precisionM),
    // Type figé à la création — jamais modifiable ensuite (voir
    // modifierBoutique) : changer le type d'une boutique déjà référencée
    // créerait un état incohérent (stock sur une boutique 'service', etc.)
    p_type_boutique: champs?.type_boutique || "produit",
    p_metier: champs?.metier?.trim() || null,
    p_description_prestation: champs?.description_prestation?.trim() || null,
    p_categorie_etablissement: champs?.categorie_etablissement || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Corrige l'étiquette d'une boutique : nom, quartier, ville, WhatsApp, et
 * selon le type déjà fixé à la création, métier/description ou catégorie
 * d'établissement. La position et le type_boutique n'en font pas partie —
 * relevés/choisis une seule fois, à la création.
 */
export async function modifierBoutique(storeId, champs) {
  const nom = String(champs?.nom || "").trim();
  if (!nom) throw new Error("Le nom de la boutique est obligatoire.");

  const { data, error } = await supabase.rpc("modifier_ma_boutique", {
    p_id: storeId,
    p_nom: nom,
    p_quartier: champs?.quartier?.trim() || null,
    p_ville: champs?.ville?.trim() || null,
    p_whatsapp: normaliserWhatsapp(champs?.telephone_whatsapp),
    p_metier: champs?.metier?.trim() || null,
    p_description_prestation: champs?.description_prestation?.trim() || null,
    p_categorie_etablissement: champs?.categorie_etablissement || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Enregistre l'avatar façon Bitmoji de la boutique (config DiceBear, pas une
 * image rendue). Fonction séparée de modifierBoutique/modifier_ma_boutique :
 * un nom de RPC neuf ne peut pas créer de collision de surcharge — voir le
 * commentaire de la migration 20260910090000.
 */
export async function modifierAvatarBoutique(storeId, avatarConfig) {
  if (!storeId) throw new Error("Boutique introuvable.");
  const { data, error } = await supabase.rpc("modifier_mon_avatar_boutique", {
    p_store_id: storeId,
    p_avatar_config: avatarConfig,
  });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Un numéro sénégalais se saisit couramment « 77 123 45 67 ». Le lien wa.me
 * exige le format international sans séparateur : on normalise ici plutôt que
 * de compter sur la saisie, sinon le bouton WhatsApp ouvre une conversation
 * vide et personne ne comprend pourquoi.
 */
export function normaliserWhatsapp(saisie) {
  const brut = String(saisie || "").replace(/[^0-9+]/g, "");
  if (!brut) return null;
  if (brut.startsWith("+")) return brut;
  if (brut.startsWith("221")) return `+${brut}`;
  if (brut.length === 9) return `+221${brut}`;
  return `+${brut}`;
}

// ---------------------------------------------------------------------------
// Signalement
// ---------------------------------------------------------------------------

/**
 * Motifs proposés à l'acheteur. Volontairement courts et concrets : une liste
 * abstraite (« contenu inapproprié ») produit des signalements qu'un
 * administrateur ne sait pas trancher.
 */
export const MOTIFS_SIGNALEMENT = [
  { id: "inexistant", label: "L'article n'existe pas / plus" },
  { id: "prix_trompeur", label: "Le prix affiché est faux" },
  { id: "contrefacon", label: "Contrefaçon" },
  { id: "interdit", label: "Produit interdit ou dangereux" },
  { id: "autre", label: "Autre" },
];

/**
 * Signale une annonce. La fonction refuse le signalement de sa propre annonce
 * et n'accepte qu'un signalement par personne : réenvoyer le même remplace le
 * précédent au lieu d'en créer un second.
 */
export async function signalerAnnonce(itemId, motif, details) {
  const { data, error } = await supabase.rpc("signaler_annonce", {
    p_item_id: itemId,
    p_motif: motif,
    p_details: details?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

/** Lien de conversation pré-rempli, avec le titre de l'article. */
export function lienWhatsapp(numero, titreArticle) {
  const n = normaliserWhatsapp(numero);
  if (!n) return null;
  const texte = encodeURIComponent(
    `Bonjour, je vous contacte via Facilité au sujet de : ${titreArticle || "votre article"}. Est-il toujours disponible ?`
  );
  return `https://wa.me/${n.replace("+", "")}?text=${texte}`;
}

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

export async function chargerMesArticles(storeId) {
  if (!storeId) return [];
  const { data, error } = await supabase
    .from("marketplace_items")
    .select("*")
    .eq("store_id", storeId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function publierArticle(storeId, champs) {
  if (!storeId) throw new Error("Créez d'abord votre boutique.");

  const titre = String(champs?.titre || "").trim();
  if (!titre) throw new Error("Le titre est obligatoire.");

  // La boutique est transmise, mais son appartenance est vérifiée par la
  // fonction : avec deux points de vente, la déduire du propriétaire rangeait
  // tous les articles dans le premier créé, en silence.
  const { data, error } = await supabase.rpc("publier_mon_article", {
    p_store_id: storeId,
    p_titre: titre,
    p_categorie: champs?.categorie || "autre",
    p_prix: Math.max(0, Math.round(Number(champs?.prix_xof) || 0)),
    p_quantite: Math.max(0, Math.round(Number(champs?.quantite) || 0)),
    p_description: champs?.description?.trim() || null,
    // Uniquement des chemins de bucket. Le CHECK de la table refuse toute
    // autre forme, base64 compris.
    p_photos: Array.isArray(champs?.photos) ? champs.photos.slice(0, 6) : [],
  });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Réactualisation express du stock : le geste le plus fréquent du vendeur, et
 * celui dont dépend la confiance de l'acheteur. `updated_at` est posé par un
 * trigger, jamais par le client — c'est la seule date qui justifie un
 * déplacement, elle ne doit pas dépendre de l'horloge d'un téléphone.
 */
export async function majStock(itemId, quantite) {
  const { data, error } = await supabase.rpc("maj_stock_article", {
    p_id: itemId,
    p_quantite: Math.max(0, Math.round(Number(quantite) || 0)),
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function retirerArticle(itemId) {
  const { error } = await supabase.rpc("retirer_mon_article", { p_id: itemId });
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Recherche acheteur
// ---------------------------------------------------------------------------

/**
 * Charge l'ensemble des articles actifs récents de la plateforme (flux global).
 * Utilisé par défaut dès l'arrivée sur la Marketplace pour que tous les produits
 * soient immédiatement visibles sans obliger l'activation préalable du GPS.
 */
export async function chargerTousLesArticles({
  categorie = null,
  texte = null,
  seulementEnStock = false,
  limite = 60,
} = {}) {
  let query = supabase
    .from("marketplace_items")
    .select(`
      id,
      titre,
      description,
      categorie,
      prix_xof,
      quantite,
      statut,
      photos,
      updated_at,
      store:marketplace_stores!inner (
        id,
        nom,
        quartier,
        ville,
        telephone_whatsapp,
        latitude,
        longitude,
        avatar_config
      )
    `)
    .eq("actif", true)
    .eq("store.actif", true)
    .order("updated_at", { ascending: false })
    .limit(limite);

  if (categorie) {
    query = query.eq("categorie", categorie);
  }
  if (seulementEnStock) {
    query = query.gt("quantite", 0);
  }
  if (texte && texte.trim()) {
    query = query.ilike("titre", `%${texte.trim()}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((r) => ({
    id: r.id,
    titre: r.titre,
    description: r.description,
    categorie: r.categorie,
    prix_xof: r.prix_xof,
    quantite: r.quantite,
    statut: r.statut,
    photos: Array.isArray(r.photos) ? r.photos.map(urlPhoto) : [],
    maj_le: r.updated_at,
    boutique_id: r.store?.id,
    boutique_nom: r.store?.nom,
    boutique_quartier: r.store?.quartier,
    boutique_ville: r.store?.ville,
    boutique_lat: r.store?.latitude,
    boutique_lng: r.store?.longitude,
    boutique_avatar_config: r.store?.avatar_config || null,
    whatsapp: r.store?.telephone_whatsapp,
    whatsappUrl: lienWhatsapp(r.store?.telephone_whatsapp, r.titre),
    distance_km: null,
    distanceLisible: r.store?.ville
      ? r.store?.quartier
        ? `${r.store.quartier}, ${r.store.ville}`
        : r.store.ville
      : "Sénégal",
  }));
}

/**
 * Articles triés du plus proche au plus éloigné.
 *
 * Le tri est fait par la base (fonction rechercher_articles_proches), pas par
 * le navigateur : trier côté client supposerait de télécharger tout le
 * catalogue pour n'en afficher que le début.
 */
export async function chercherAutourDeMoi({
  latitude,
  longitude,
  rayonKm = 10,
  categorie = null,
  texte = null,
  seulementEnStock = false,
  limite = 40,
}) {
  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
    throw new Error("Position indisponible. Autorisez la localisation pour trier par proximité.");
  }

  const { data, error } = await supabase.rpc("rechercher_articles_proches", {
    p_lat: Number(latitude),
    p_lng: Number(longitude),
    p_rayon_km: rayonKm,
    p_categorie: categorie,
    p_texte: texte,
    p_en_stock: seulementEnStock,
    p_limite: limite,
  });
  if (error) throw new Error(error.message);

  return (data || []).map((r) => ({
    ...r,
    photos: Array.isArray(r.photos) ? r.photos.map(urlPhoto) : [],
    whatsappUrl: lienWhatsapp(r.whatsapp, r.titre),
    distanceLisible: r.distance_km < 1 ? `${Math.round(r.distance_km * 1000)} m` : `${r.distance_km} km`,
  }));
}

/**
 * Boutiques de type 'service' ou 'etablissement' autour d'une position —
 * pendant de chercherAutourDeMoi pour les boutiques SANS aucun article.
 *
 * rechercher_articles_proches part de marketplace_items : une boutique
 * service/établissement (pas de catalogue produits) y est structurellement
 * invisible, quel que soit son statut. D'où cette fonction séparée, qui
 * interroge rechercher_boutiques_proches (SQL) directement sur
 * marketplace_stores.
 *
 * Forme de retour compatible avec un "regroupement par boutique" comme
 * celui déjà fait par les composants carte pour les articles (id, nom,
 * quartier, position, distance_km, articles: []) : ces boutiques peuvent
 * être fusionnées avec la liste de boutiques dérivée des articles sans
 * traitement spécial côté carte, seul le type_boutique varie l'icône/la
 * fiche affichée.
 */
export async function chercherServicesEtEtablissements({
  latitude,
  longitude,
  rayonKm = 10,
  texte = null,
  type = null, // 'service' | 'etablissement' | null (les deux)
  limite = 40,
} = {}) {
  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
    return [];
  }

  const { data, error } = await supabase.rpc("rechercher_boutiques_proches", {
    p_lat: Number(latitude),
    p_lng: Number(longitude),
    p_rayon_km: rayonKm,
    p_texte: texte,
    p_type: type,
    p_limite: limite,
  });
  if (error) throw new Error(error.message);

  return (data || []).map((r) => ({
    id: r.id,
    nom: r.nom,
    quartier: r.quartier,
    ville: r.ville,
    type_boutique: r.type_boutique,
    metier: r.metier,
    description_prestation: r.description_prestation,
    categorie_etablissement: r.categorie_etablissement,
    mode_horaires: r.mode_horaires || "indiques",
    telephone_whatsapp: r.telephone_whatsapp,
    whatsappUrl: lienWhatsapp(r.telephone_whatsapp, r.nom),
    avatar_config: r.avatar_config || null,
    distance_km: r.distance_km,
    distanceLisible: r.distance_km == null ? "" : r.distance_km < 1 ? `${Math.round(r.distance_km * 1000)} m` : `${r.distance_km} km`,
    lat: r.latitude,
    lng: r.longitude,
    articles: [],
  }));
}

// ---------------------------------------------------------------------------
// Métiers (boutiques type_boutique = 'service')
// ---------------------------------------------------------------------------

/**
 * Liste prédéfinie proposée à la création/modification d'une boutique
 * service (voir FormulaireBoutique) — remplace l'ancien champ texte libre.
 * "Autre (précisez)" n'est pas une valeur stockée : sélectionnée, elle fait
 * apparaître un champ texte dont la saisie devient directement `metier`.
 */
export const METIERS_SERVICE = [
  "Chauffeur",
  "Mécanicien",
  "Livreur",
  "Plombier",
  "Électricien",
  "Maçon",
  "Peintre bâtiment",
  "Menuisier",
  "Femme de ménage",
  "Jardinier",
  "Coiffeur/Coiffeuse",
  "Couturier/Couturière",
  "Pharmacien",
  "Infirmier/Infirmière",
  "Sage-femme",
  "Professeur particulier",
  "Photographe",
];

/**
 * Métiers réglementés : mêmes chaînes EXACTES que côté serveur (policies RLS
 * marketplace_stores/marketplace_horaires + rechercher_boutiques_proches,
 * migration 20260912...) — une fiche portant un de ces métiers reste
 * masquée du public tant que verifie=false, même mécanisme que
 * categorie_etablissement IN ('sante','finance'). Toute nouvelle profession
 * de santé ajoutée ici doit l'être aussi côté SQL, jamais l'un sans l'autre.
 */
export const METIERS_REGLEMENTES = ["Pharmacien", "Infirmier/Infirmière", "Sage-femme"];

// ---------------------------------------------------------------------------
// Horaires (établissements)
// ---------------------------------------------------------------------------

/** jour_semaine suit la convention JS `Date.getDay()` : 0 = dimanche. */
export const JOURS_SEMAINE = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

/** Horaires d'ouverture d'un établissement, un par jour (0-6), triés. */
export async function obtenirHorairesBoutique(storeId) {
  if (!storeId) return [];
  const { data, error } = await supabase
    .from("marketplace_horaires")
    .select("jour_semaine, heure_ouverture, heure_fermeture, ferme_ce_jour")
    .eq("store_id", storeId)
    .order("jour_semaine", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Remplace les horaires d'un établissement (les 7 jours d'un coup — voir
 * enregistrer_mes_horaires, qui met à jour mode_horaires sur marketplace_stores
 * puis supprime et réinsère la grille). `horaires` : [{ jour_semaine,
 * heure_ouverture, heure_fermeture, ferme_ce_jour }, ...].
 */
export async function enregistrerHoraires(storeId, horaires, modeHoraires = "indiques") {
  if (!storeId || storeId === "facilite_shop") return;
  try {
    const { error } = await supabase.rpc("enregistrer_mes_horaires", {
      p_store_id: storeId,
      p_horaires: horaires || [],
      p_mode_horaires: modeHoraires || "indiques",
    });
    if (error) {
      // Fallback si signature à 2 arguments
      const { error: errorFallback } = await supabase.rpc("enregistrer_mes_horaires", {
        p_store_id: storeId,
        p_horaires: horaires || [],
      });
      if (errorFallback) throw new Error(error.message || errorFallback.message);
    }
  } catch (err) {
    throw err;
  }
}

/**
 * Calcule le jour de la semaine (0 = Dimanche ... 6 = Samedi) et l'heure
 * actuelle sur le fuseau horaire officiel du Sénégal (Africa/Dakar, UTC+0).
 */
export function obtenirDateHeureDakar(date = new Date()) {
  try {
    const formateurJour = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Dakar",
      weekday: "short",
    });
    const formateurHeure = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Dakar",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const mapJours = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const jourSemaine = mapJours[formateurJour.format(date)] ?? date.getUTCDay();

    const parties = formateurHeure.formatToParts(date);
    const heure = parseInt(parties.find((p) => p.type === "hour")?.value || "0", 10);
    const minute = parseInt(parties.find((p) => p.type === "minute")?.value || "0", 10);
    const minutesActuelles = heure * 60 + minute;

    return { jourSemaine, heure, minute, minutesActuelles };
  } catch {
    const jourSemaine = date.getUTCDay();
    const heure = date.getUTCHours();
    const minute = date.getUTCMinutes();
    return { jourSemaine, heure, minute, minutesActuelles: heure * 60 + minute };
  }
}

/**
 * Détermine le statut d'ouverture en direct pour un établissement.
 * Concerne uniquement type_boutique = 'etablissement'.
 *
 * Retourne un objet :
 * {
 *   ouvert: boolean | null,
 *   mode: 'indiques' | 'toujours_ouvert' | 'sur_rendez_vous',
 *   couleur: 'emerald' | 'rose' | 'sky' | 'zinc',
 *   texteBadge: string | null,
 *   texteDetail: string,
 *   renseigne: boolean
 * }
 */
export const HORAIRES_DEFAUT = [
  { jour_semaine: 1, heure_ouverture: "08:00:00", heure_fermeture: "18:00:00", ferme_ce_jour: false },
  { jour_semaine: 2, heure_ouverture: "08:00:00", heure_fermeture: "18:00:00", ferme_ce_jour: false },
  { jour_semaine: 3, heure_ouverture: "08:00:00", heure_fermeture: "18:00:00", ferme_ce_jour: false },
  { jour_semaine: 4, heure_ouverture: "08:00:00", heure_fermeture: "18:00:00", ferme_ce_jour: false },
  { jour_semaine: 5, heure_ouverture: "08:00:00", heure_fermeture: "18:00:00", ferme_ce_jour: false },
  { jour_semaine: 6, heure_ouverture: "09:00:00", heure_fermeture: "17:00:00", ferme_ce_jour: false },
  { jour_semaine: 0, heure_ouverture: "10:00:00", heure_fermeture: "15:00:00", ferme_ce_jour: true },
];

/**
 * Détermine en direct si une boutique/établissement est ouvert(e), fermé(e),
 * ouvert(e) 24h/24 ou sur rendez-vous à une heure donnée (fuseau Africa/Dakar).
 */
export function calculerStatutOuverture(boutique, horaires = [], dateReference = new Date()) {
  const mode = boutique?.mode_horaires || "indiques";

  if (mode === "toujours_ouvert") {
    return {
      ouvert: true,
      mode: "toujours_ouvert",
      couleur: "emerald",
      texteBadge: "Ouvert 24h/24",
      texteDetail: "Ouvert 24h/24, 7j/7",
      renseigne: true,
    };
  }

  if (mode === "sur_rendez_vous") {
    return {
      ouvert: null,
      mode: "sur_rendez_vous",
      couleur: "sky",
      texteBadge: "Sur rendez-vous",
      texteDetail: "Accueil uniquement sur rendez-vous",
      renseigne: true,
    };
  }

  // Mode "indiques" sans aucune ligne configurée : aucun badge plutôt qu'un
  // "Fermé" calculé sur une grille fictive — HORAIRES_DEFAUT ne sert que
  // d'aperçu visuel dans GrilleHorairesEtablissement (pour donner un exemple
  // de mise en forme au vendeur qui n'a encore rien renseigné), jamais de
  // base pour un vrai statut affiché à l'acheteur : ce serait trompeur
  // (établissement jamais configuré présenté comme "Fermé", donnée fausse).
  if (!Array.isArray(horaires) || horaires.length === 0) {
    return {
      ouvert: null,
      mode: "indiques",
      couleur: "zinc",
      texteBadge: null,
      texteDetail: "Horaires non renseignés",
      renseigne: false,
    };
  }

  const { jourSemaine, minutesActuelles } = obtenirDateHeureDakar(dateReference);
  const hJour = horaires.find((h) => Number(h.jour_semaine) === jourSemaine);

  if (!hJour || hJour.ferme_ce_jour || !hJour.heure_ouverture || !hJour.heure_fermeture) {
    return {
      ouvert: false,
      mode: "indiques",
      couleur: "rose",
      texteBadge: "Fermé",
      texteDetail: "Fermé aujourd'hui",
      renseigne: true,
    };
  }

  const parseMinutes = (str) => {
    if (!str) return null;
    const [h, m] = str.slice(0, 5).split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  };

  const ouvMin = parseMinutes(hJour.heure_ouverture);
  const fermMin = parseMinutes(hJour.heure_fermeture);

  if (ouvMin === null || fermMin === null) {
    return {
      ouvert: false,
      mode: "indiques",
      couleur: "rose",
      texteBadge: "Fermé",
      texteDetail: "Fermé",
      renseigne: true,
    };
  }

  const formatHeure = (str) => str?.slice(0, 5) || "";

  let estOuvert = false;
  if (ouvMin < fermMin) {
    // Journée standard (ex. 08:00 - 18:00)
    estOuvert = minutesActuelles >= ouvMin && minutesActuelles < fermMin;
  } else if (ouvMin > fermMin) {
    // Nocturne passant minuit (ex. 20:00 - 04:00)
    estOuvert = minutesActuelles >= ouvMin || minutesActuelles < fermMin;
  } else {
    // 00:00 - 00:00 (ouvert toute la journée)
    estOuvert = true;
  }

  if (estOuvert) {
    return {
      ouvert: true,
      mode: "indiques",
      couleur: "emerald",
      texteBadge: "Ouvert",
      texteDetail: `Ferme à ${formatHeure(hJour.heure_fermeture)}`,
      renseigne: true,
    };
  } else {
    const detail = minutesActuelles < ouvMin
      ? `Ouvre à ${formatHeure(hJour.heure_ouverture)}`
      : "Fermé pour la journée";
    return {
      ouvert: false,
      mode: "indiques",
      couleur: "rose",
      texteBadge: "Fermé",
      texteDetail: detail,
      renseigne: true,
    };
  }
}

/** Position du navigateur, en promesse. */
export function positionActuelle() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Localisation non disponible sur cet appareil."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      (err) => reject(new Error(err.message || "Localisation refusée.")),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  });
}

// ---------------------------------------------------------------------------
// Jetons Marketplace (voir supabase/migrations/20260912020000_jetons_marketplace.sql)
// ---------------------------------------------------------------------------

/**
 * Taux de change courant — coût d'un jeton en FCFA et nombre de jetons
 * requis pour activer 1 an de Premium Marketplace. Lu depuis jetons_config
 * (table à une seule ligne, jamais codé en dur) : ces deux chiffres restent
 * à décider par le métier, ajustables par simple UPDATE SQL sans
 * redéploiement.
 */
export async function obtenirTauxJetons() {
  const { data, error } = await supabase
    .from("jetons_config")
    .select("cout_jeton_fcfa, jetons_requis_premium_an")
    .eq("id", 1)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Solde de jetons d'une boutique — 0 si elle n'a encore jamais rien acheté. */
export async function obtenirSoldeJetons(storeId) {
  if (!storeId) return 0;
  const { data, error } = await supabase
    .from("jetons_boutique")
    .select("solde_jetons")
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.solde_jetons ?? 0;
}

/** Historique des mouvements de jetons d'une boutique, plus récents d'abord. */
export async function obtenirHistoriqueJetons(storeId) {
  if (!storeId) return [];
  const { data, error } = await supabase
    .from("jetons_transactions")
    .select("id, montant, type, status, created_at")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Période Premium Marketplace en cours pour une boutique, ou null si
 * aucune n'est active actuellement (expirée ou jamais activée). "Actif"
 * est vérifié à la lecture (date_expiration > maintenant), jamais stocké
 * comme booléen à tenir à jour.
 */
export async function obtenirPremiumActif(storeId) {
  if (!storeId) return null;
  const { data, error } = await supabase
    .from("premium_marketplace")
    .select("id, date_activation, date_expiration")
    .eq("store_id", storeId)
    .gt("date_expiration", new Date().toISOString())
    .order("date_expiration", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

/**
 * Active 1 an de Premium Marketplace pour une boutique en dépensant ses
 * jetons — dépense, journal et création de la période dans une seule
 * transaction atomique côté serveur (voir activer_premium_marketplace,
 * SECURITY DEFINER). Lève une erreur explicite (message lisible transmis
 * tel quel par PostgREST) si une période est déjà active, ou si le solde
 * est insuffisant.
 */
export async function activerPremiumMarketplace(storeId) {
  const { data, error } = await supabase.rpc("activer_premium_marketplace", { p_store_id: storeId });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Ensemble des store_id ayant actuellement une période Premium Marketplace
 * active — utilisé pour mettre en avant ces boutiques (tri + badge) sur la
 * carte et dans les résultats de recherche. Une seule requête légère,
 * jamais un JOIN ajouté aux fonctions de recherche existantes (rester au
 * plus près de ce qui existe déjà plutôt que remanier des RPC partagées).
 */
export async function obtenirBoutiquesPremiumActives() {
  const { data, error } = await supabase
    .from("premium_marketplace")
    .select("store_id")
    .gt("date_expiration", new Date().toISOString());
  if (error) throw new Error(error.message);
  return new Set((data || []).map((r) => r.store_id));
}
