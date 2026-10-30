import * as ImagePicker from 'expo-image-picker';
import { permissionGalerie } from '@/lib/galerie';
import * as ImageManipulator from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';
import { BUCKET_VIDEOS, normaliserWhatsapp, urlPhoto, type Position } from '@/lib/marketplace';

// Espace vendeur natif — port mobile de src/lib/marketplaceData.js (web) :
// mêmes RPC SECURITY DEFINER (jamais d'UPDATE/DELETE direct sur les tables,
// voir l'invariant 1 du dépôt), même bucket, mêmes contraintes.

export const BOUTIQUES_OFFERTES = 1;

// Les 45 départements du Sénégal (identique à MarketplaceClient.jsx côté web).
export const DEPARTEMENTS_SENEGAL = [
  'Dakar', 'Guédiawaye', 'Pikine', 'Rufisque', 'Keur Massar', 'Thiès', 'Mbour', 'Tivaouane',
  'Diourbel', 'Bambey', 'Mbacké', 'Touba', 'Fatick', 'Foundiougne', 'Gossas', 'Kaolack',
  'Guinguinéo', 'Nioro du Rip', 'Kaffrine', 'Birkelane', 'Koungheul', 'Malem-Hodar', 'Saint-Louis',
  'Dagana', 'Podor', 'Louga', 'Kébémer', 'Linguère', 'Matam', 'Kanel', 'Ranérou-Ferlo',
  'Tambacounda', 'Bakel', 'Goudiry', 'Koumpentoum', 'Kédougou', 'Salémata', 'Saraya', 'Kolda',
  'Médina Yoro Foulah', 'Vélingara', 'Sédhiou', 'Bounkiling', 'Goudomp', 'Ziguinchor', 'Bignona',
  'Oussouye',
];

export type MaBoutique = {
  id: string;
  nom: string;
  quartier: string | null;
  ville: string | null;
  telephone_whatsapp: string | null;
  actif: boolean;
  type_boutique: string;
  latitude: number | null;
  longitude: number | null;
  metier: string | null;
  description_prestation: string | null;
  categorie_etablissement: string | null;
  disponible_manuel: boolean;
  /** Chemin du logo dans le bucket marketplace-photos (voir definirLogoBoutique). */
  logo_photo: string | null;
  /** Chemin de la photo de couverture dans le bucket marketplace-photos (voir definirCouvertureBoutique). */
  cover_photo: string | null;
  /** 9 derniers chiffres du numéro WhatsApp CONFIRMÉ par code ; la confirmation vaut tant que le numéro actuel est celui-là. */
  whatsapp_confirme_numero?: string | null;
};

/** Une boutique vue par n'importe quel visiteur (page publique) : mêmes champs que MaBoutique + propriétaire et avatar. */
export type BoutiquePublique = MaBoutique & {
  owner_id: string;
  avatar_config: Record<string, unknown> | null;
};

/** Boutique ACTIVE lisible de tous (policy « actifs visibles de tous »). Null si introuvable ou masquée. */
export async function chargerBoutiquePublique(id: string): Promise<BoutiquePublique | null> {
  const { data, error } = await supabase
    .from('marketplace_stores')
    .select(
      'id, owner_id, nom, quartier, ville, telephone_whatsapp, actif, type_boutique, latitude, longitude, metier, description_prestation, categorie_etablissement, disponible_manuel, logo_photo, cover_photo, avatar_config'
    )
    .eq('id', id)
    .eq('actif', true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as BoutiquePublique | null) ?? null;
}

export type MonArticle = {
  id: string;
  titre: string;
  description: string | null;
  categorie: string;
  prix_xof: number;
  quantite: number;
  statut: string;
  photos: string[];
  /** Chemin de la vidéo dans marketplace-videos, ou null. */
  url_video: string | null;
  actif: boolean;
  updated_at: string;
};

function listePhotosBrutes(brut: unknown): string[] {
  let liste: unknown = brut;
  if (typeof liste === 'string') {
    try {
      liste = JSON.parse(liste || '[]');
    } catch {
      liste = [liste];
    }
  }
  return Array.isArray(liste) ? (liste as string[]) : [];
}

export async function chargerMesBoutiques(userId: string): Promise<MaBoutique[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('marketplace_stores')
    .select(
      'id, nom, quartier, ville, telephone_whatsapp, actif, type_boutique, latitude, longitude, metier, description_prestation, categorie_etablissement, disponible_manuel, logo_photo, cover_photo, whatsapp_confirme_numero'
    )
    .eq('owner_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Étape 1 de « Devenir Vendeur » : prénom, nom, téléphone et e-mail du
 * compte. Même écriture que « Informations personnelles » (table profiles,
 * RLS : chacun ne modifie que sa propre ligne).
 */
export async function enregistrerIdentiteVendeur(
  userId: string,
  champs: { prenom: string; nom: string; telephone?: string; email: string }
): Promise<void> {
  // `telephone` = NUMÉRO D'APPEL (profiles.phone), saisi par la personne, sans confirmation ; vide = on ne touche pas au numéro déjà enregistré.
  // Même écriture directe que le site (vendeur-informations-personnelles, fenêtre « Coordonnées » de Locaux) : aucune écriture nouvelle ni élargie.
  const numeroAppel = champs.telephone?.trim();
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: `${champs.prenom.trim()} ${champs.nom.trim()}`.trim(),
      ...(numeroAppel ? { phone: numeroAppel } : {}),
      contact_email: champs.email.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (error) {
    // La base refuse un numéro déjà utilisé par un autre compte (code 23505) : on le dit, sans dire à qui il est.
    throw new Error(error.code === '23505' ? 'Ce numéro est déjà utilisé par un autre compte.' : "Impossible d'enregistrer vos informations pour le moment.");
  }
}

/**
 * Change le seul numéro WhatsApp d'une boutique : modifier_ma_boutique remplace TOUS les champs reçus, on lui renvoie donc les valeurs actuelles de la boutique
 * (nom, quartier, ville, métier…) avec le nouveau numéro. Même fonction SQL que le formulaire de la boutique.
 */
export async function changerWhatsappBoutique(boutique: MaBoutique, numero: string): Promise<void> {
  await modifierBoutique(boutique.id, {
    nom: boutique.nom,
    quartier: boutique.quartier,
    ville: boutique.ville,
    telephoneWhatsapp: numero,
    metier: boutique.metier,
    descriptionPrestation: boutique.description_prestation,
    categorieEtablissement: boutique.categorie_etablissement,
  });
}

export async function chargerMesArticles(storeId: string): Promise<MonArticle[]> {
  if (!storeId) return [];
  const { data, error } = await supabase
    .from('marketplace_items')
    .select('id, titre, description, categorie, prix_xof, quantite, statut, photos, url_video, actif, updated_at')
    .eq('store_id', storeId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ ...r, photos: listePhotosBrutes(r.photos) }));
}

/** Position approximative de l'appareil (fenêtre native de permission déjà gérée par useLocalisation). */
export async function creerBoutique(
  userId: string,
  champs: { nom: string; quartier?: string | null; ville?: string | null; telephoneWhatsapp?: string | null; position?: Position | null }
): Promise<string> {
  const nom = champs.nom.trim();
  if (!nom) throw new Error('Le nom de la boutique est obligatoire.');
  const { data, error } = await supabase.rpc('creer_ma_boutique', {
    p_nom: nom,
    p_quartier: champs.quartier?.trim() || null,
    p_ville: champs.ville?.trim() || null,
    p_whatsapp: normaliserWhatsapp(champs.telephoneWhatsapp),
    p_lat: champs.position?.latitude ?? null,
    p_lng: champs.position?.longitude ?? null,
    p_precision_m: null,
    p_type_boutique: 'produit',
    p_metier: null,
    p_description_prestation: null,
    p_categorie_etablissement: null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function modifierBoutique(
  storeId: string,
  champs: {
    nom: string;
    quartier?: string | null;
    ville?: string | null;
    telephoneWhatsapp?: string | null;
    metier?: string | null;
    descriptionPrestation?: string | null;
    categorieEtablissement?: string | null;
    // 'service' | 'etablissement' : passer l'un des deux bascule le type
    // principal de la boutique sur cette rubrique (voir modifier_ma_boutique,
    // 20260917030000) — c'est le mécanisme qui rend Service/Établissement
    // réellement modifiables pour une boutique créée en « produit ».
    typeBoutique?: 'produit' | 'service' | 'etablissement' | null;
  }
): Promise<void> {
  const nom = champs.nom.trim();
  if (!nom) throw new Error('Le nom de la boutique est obligatoire.');
  const { error } = await supabase.rpc('modifier_ma_boutique', {
    p_id: storeId,
    p_nom: nom,
    p_quartier: champs.quartier?.trim() || null,
    p_ville: champs.ville?.trim() || null,
    p_whatsapp: normaliserWhatsapp(champs.telephoneWhatsapp),
    p_metier: champs.metier?.trim() || null,
    p_description_prestation: champs.descriptionPrestation?.trim() || null,
    p_categorie_etablissement: champs.categorieEtablissement || null,
    p_mode_horaires: null,
    p_type_boutique: champs.typeBoutique || null,
  });
  if (error) throw new Error(error.message);
}

/** Boutique disponible maintenant, ou indisponible (Service / Établissement). */
/** Enregistre (ou retire, avec null) le logo de la boutique : chemin renvoyé par envoyerPhotoArticle. */
export async function definirLogoBoutique(storeId: string, chemin: string | null): Promise<void> {
  const { error } = await supabase.rpc('definir_logo_ma_boutique', { p_store_id: storeId, p_logo: chemin });
  if (error) throw new Error(error.message);
}

/** Enregistre (ou retire, avec null) la photo de couverture de la boutique : chemin renvoyé par envoyerPhotoArticle. */
export async function definirCouvertureBoutique(storeId: string, chemin: string | null): Promise<void> {
  const { error } = await supabase.rpc('definir_couverture_ma_boutique', { p_store_id: storeId, p_cover: chemin });
  if (error) throw new Error(error.message);
}

export async function definirDisponibiliteBoutique(storeId: string, disponible: boolean): Promise<void> {
  const { error } = await supabase.rpc('definir_disponibilite_boutique', { p_store_id: storeId, p_disponible: disponible });
  if (error) throw new Error(error.message);
}

/** Boutique visible ou masquée sur le Marketplace. */
export async function definirVisibiliteBoutique(storeId: string, actif: boolean): Promise<void> {
  const { error } = await supabase.rpc('definir_visibilite_boutique', { p_id: storeId, p_actif: actif });
  if (error) throw new Error(error.message);
}

export async function publierArticle(
  storeId: string,
  champs: {
    titre: string;
    categorie: string;
    prixXof: number;
    quantite: number;
    description?: string;
    photos: string[];
    /** Chemin de la vidéo dans le bucket marketplace-videos, ou null. */
    urlVideo?: string | null;
    /** Branche de l'arbre des catégories (identifiants de la table categories). */
    sousCategorie?: string | null;
    typeArticle?: string | null;
    etat?: string | null;
    marque?: string | null;
    taille?: string | null;
  }
): Promise<string> {
  const titre = champs.titre.trim();
  if (!titre) throw new Error('Le titre est obligatoire.');
  const { data, error } = await supabase.rpc('publier_mon_article', {
    p_store_id: storeId,
    p_titre: titre,
    p_categorie: champs.categorie || 'autre',
    p_prix: Math.max(0, Math.round(champs.prixXof || 0)),
    p_quantite: Math.max(0, Math.round(champs.quantite || 0)),
    p_description: champs.description?.trim() || null,
    p_photos: champs.photos.slice(0, 6),
    p_url_video: champs.urlVideo ?? null,
    p_sous_categorie: champs.sousCategorie ?? null,
    p_type_article: champs.typeArticle ?? null,
    p_etat: champs.etat ?? null,
    p_marque: champs.marque ?? null,
    p_taille: champs.taille ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * Modifier un article déjà publié (titre, catégorie, prix, quantité,
 * description, photos) — même RPC que le site (modifier_mon_article,
 * appartenance revérifiée côté base). Aucune table n'accorde jamais
 * d'UPDATE direct à authenticated (invariant 1).
 */
export async function modifierArticle(
  itemId: string,
  champs: {
    titre: string;
    categorie: string;
    prixXof: number;
    quantite: number;
    description?: string;
    photos: string[];
    urlVideo?: string | null;
  }
): Promise<void> {
  const titre = champs.titre.trim();
  if (!titre) throw new Error('Le titre est obligatoire.');
  const { error } = await supabase.rpc('modifier_mon_article', {
    p_id: itemId,
    p_titre: titre,
    p_categorie: champs.categorie || 'autre',
    p_prix: Math.max(0, Math.round(champs.prixXof || 0)),
    p_quantite: Math.max(0, Math.round(champs.quantite || 0)),
    p_description: champs.description?.trim() || null,
    p_photos: champs.photos.slice(0, 6),
    p_url_video: champs.urlVideo ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function majStock(itemId: string, quantite: number): Promise<void> {
  const { error } = await supabase.rpc('maj_stock_article', { p_id: itemId, p_quantite: Math.max(0, Math.round(quantite || 0)) });
  if (error) throw new Error(error.message);
}

export async function retirerArticle(itemId: string): Promise<void> {
  const { error } = await supabase.rpc('retirer_mon_article', { p_id: itemId });
  if (error) throw new Error(error.message);
}

const BUCKET_PHOTOS = 'marketplace-photos';
// Plafond du bucket marketplace-videos (20261009100000).
const TAILLE_MAX_VIDEO_OCTETS = 30 * 1024 * 1024;
const LARGEUR_MAX = 1280;
const QUALITE_INITIALE = 0.72;
const POIDS_VISE_OCTETS = 220 * 1024;

/**
 * Compresse une photo (redimensionnée à 1280 px de large maximum, JPEG,
 * qualité réduite jusqu'à 3 fois si nécessaire pour viser ~220 Ko) et la
 * dépose dans le bucket. Chemin préfixé par l'id du vendeur : la policy
 * Storage l'exige (voir migration 20260901190000), sinon l'envoi est rejeté.
 */
export async function envoyerPhotoArticle(
  uri: string,
  dimensions: { width: number; height: number },
  userId: string
): Promise<string> {
  if (!userId) throw new Error('Connexion requise pour publier une photo.');

  const ratio = Math.min(1, LARGEUR_MAX / Math.max(dimensions.width, dimensions.height));
  const largeur = Math.round(dimensions.width * ratio);
  const hauteur = Math.round(dimensions.height * ratio);

  let qualite = QUALITE_INITIALE;
  let resultat = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: largeur, height: hauteur } }], {
    compress: qualite,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });

  let essais = 0;
  while ((resultat.base64?.length ?? 0) * 0.75 > POIDS_VISE_OCTETS && qualite > 0.4 && essais < 3) {
    qualite -= 0.12;
    essais += 1;
    resultat = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: largeur, height: hauteur } }], {
      compress: qualite,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
  }

  // Octets décodés depuis le base64 déjà produit : un Blob lu depuis un fichier local arrive typé « text/plain » sur Android,
  // ce que le bucket refuse (« mime type text/plain is not supported »).
  const octets = Uint8Array.from(atob(resultat.base64 ?? ''), (c) => c.charCodeAt(0));
  const nom = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

  const { error } = await supabase.storage.from(BUCKET_PHOTOS).upload(nom, octets, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw new Error(`Envoi de la photo impossible : ${error.message}`);
  return nom;
}

/**
 * Dépose la vidéo d'un article dans son bucket dédié (maquette 22).
 * Même contrainte de préfixe que les photos : le chemin commence par l'id
 * du vendeur, sinon la policy Storage rejette l'envoi. Aucune compression
 * ici — expo-image-manipulator ne traite que les images ; le plafond du
 * bucket (30 Mo) est vérifié avant l'envoi pour donner un message clair
 * plutôt qu'une erreur Storage opaque.
 */
export async function envoyerVideoArticle(uri: string, userId: string, extension = 'mp4'): Promise<string> {
  if (!userId) throw new Error('Connexion requise pour envoyer une vidéo.');

  const reponse = await fetch(uri);
  const blob = await reponse.blob();
  if (blob.size > TAILLE_MAX_VIDEO_OCTETS) {
    throw new Error('Vidéo trop lourde : 30 Mo maximum.');
  }

  const ext = extension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'mp4';
  const nom = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET_VIDEOS).upload(nom, blob, {
    contentType: blob.type || (ext === 'mov' ? 'video/quicktime' : ext === 'webm' ? 'video/webm' : 'video/mp4'),
    upsert: false,
  });
  if (error) throw new Error(`Envoi de la vidéo impossible : ${error.message}`);
  return nom;
}

export { urlPhoto };

/** Choisit une image dans la galerie (recadrée au format voulu) et l'envoie dans le bucket des photos. Renvoie le chemin, ou null si annulé. */
export async function choisirEtEnvoyerPhotoBoutique(userId: string, aspect: [number, number]): Promise<string | null> {
  const permission = await permissionGalerie();
  if (!permission.granted) throw new Error('Facilité a besoin d’accéder à vos photos pour choisir cette image.');
  const choix = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true, aspect });
  if (choix.canceled) return null;
  const a = choix.assets[0];
  return envoyerPhotoArticle(a.uri, { width: a.width, height: a.height }, userId);
}
