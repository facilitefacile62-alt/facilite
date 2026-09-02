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
  return supabase.storage.from(BUCKET).getPublicUrl(chemin).data.publicUrl;
}

/** Supprime une photo devenue inutile. L'échec n'est pas bloquant : un fichier
 *  orphelin coûte quelques kilo-octets, une annonce perdue coûte une vente. */
export async function supprimerPhoto(chemin) {
  if (!chemin) return;
  await supabase.storage.from(BUCKET).remove([chemin]).catch(() => {});
}

// ---------------------------------------------------------------------------
// Boutique du vendeur
// ---------------------------------------------------------------------------

export async function chargerMaBoutique(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("marketplace_stores")
    .select("*")
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Crée ou met à jour la boutique. La position vient de la géolocalisation du
 * navigateur, saisie une seule fois : c'est elle qui permet ensuite de trier
 * tout le stock par proximité, sans jamais géolocaliser un article.
 */
export async function enregistrerBoutique(userId, champs) {
  if (!userId) throw new Error("Connexion requise.");

  const charge = {
    nom: String(champs?.nom || "").trim(),
    quartier: champs?.quartier?.trim() || null,
    ville: champs?.ville?.trim() || null,
    telephone_whatsapp: normaliserWhatsapp(champs?.telephone_whatsapp),
    latitude: coordonnee(champs?.latitude),
    longitude: coordonnee(champs?.longitude),
  };
  if (!charge.nom) throw new Error("Le nom de la boutique est obligatoire.");

  // Écriture par fonction SECURITY DEFINER, jamais en direct : aucune table de
  // ce dépôt n'accorde UPDATE ou DELETE à `authenticated` (invariant 1, liste
  // blanche vide). La fonction déduit le propriétaire de auth.uid().
  const { data, error } = await supabase.rpc("enregistrer_ma_boutique", {
    p_nom: charge.nom,
    p_quartier: charge.quartier,
    p_ville: charge.ville,
    p_whatsapp: charge.telephone_whatsapp,
    p_lat: charge.latitude,
    p_lng: charge.longitude,
    // Précision annoncée par l'appareil. Conservée pour pouvoir expliquer
    // plus tard une boutique mal placée : un relevé à 800 m n'a pas la même
    // valeur qu'un relevé à 12 m.
    p_precision_m: coordonnee(champs?.precisionM),
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

  // La boutique n'est pas transmise : la fonction la déduit de l'identité de
  // l'appelant. Envoyer un store_id rouvrirait la brèche que la fonction ferme.
  const { data, error } = await supabase.rpc("publier_mon_article", {
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
        longitude
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
