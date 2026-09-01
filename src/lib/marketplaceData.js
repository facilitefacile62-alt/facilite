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
    owner_id: userId,
    nom: String(champs?.nom || "").trim(),
    quartier: champs?.quartier?.trim() || null,
    ville: champs?.ville?.trim() || null,
    telephone_whatsapp: normaliserWhatsapp(champs?.telephone_whatsapp),
    latitude: Number.isFinite(Number(champs?.latitude)) ? Number(champs.latitude) : null,
    longitude: Number.isFinite(Number(champs?.longitude)) ? Number(champs.longitude) : null,
  };
  if (!charge.nom) throw new Error("Le nom de la boutique est obligatoire.");

  const existante = await chargerMaBoutique(userId);
  const requete = existante
    ? supabase.from("marketplace_stores").update(charge).eq("id", existante.id)
    : supabase.from("marketplace_stores").insert(charge);

  const { data, error } = await requete.select("*").single();
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

  const charge = {
    store_id: storeId,
    titre: String(champs?.titre || "").trim(),
    description: champs?.description?.trim() || null,
    categorie: champs?.categorie || "autre",
    prix_xof: Math.max(0, Math.round(Number(champs?.prix_xof) || 0)),
    quantite: Math.max(0, Math.round(Number(champs?.quantite) || 0)),
    // Uniquement des chemins de bucket. Le CHECK de la table refuse toute
    // autre forme, base64 compris.
    photos: Array.isArray(champs?.photos) ? champs.photos.slice(0, 6) : [],
  };
  if (!charge.titre) throw new Error("Le titre est obligatoire.");

  const { data, error } = await supabase.from("marketplace_items").insert(charge).select("*").single();
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
  const { data, error } = await supabase
    .from("marketplace_items")
    .update({ quantite: Math.max(0, Math.round(Number(quantite) || 0)) })
    .eq("id", itemId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function retirerArticle(itemId) {
  const { error } = await supabase.from("marketplace_items").update({ actif: false }).eq("id", itemId);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Recherche acheteur
// ---------------------------------------------------------------------------

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
