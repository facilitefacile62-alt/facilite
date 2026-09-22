import * as ImageManipulator from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';
import { normaliserWhatsapp, urlPhoto, type Position } from '@/lib/marketplace';

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
};

export type MonArticle = {
  id: string;
  titre: string;
  description: string | null;
  categorie: string;
  prix_xof: number;
  quantite: number;
  statut: string;
  photos: string[];
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
    .select('id, nom, quartier, ville, telephone_whatsapp, actif, type_boutique, latitude, longitude')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function chargerMesArticles(storeId: string): Promise<MonArticle[]> {
  if (!storeId) return [];
  const { data, error } = await supabase
    .from('marketplace_items')
    .select('id, titre, description, categorie, prix_xof, quantite, statut, photos, actif, updated_at')
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
  champs: { nom: string; quartier?: string | null; ville?: string | null; telephoneWhatsapp?: string | null }
): Promise<void> {
  const nom = champs.nom.trim();
  if (!nom) throw new Error('Le nom de la boutique est obligatoire.');
  const { error } = await supabase.rpc('modifier_ma_boutique', {
    p_id: storeId,
    p_nom: nom,
    p_quartier: champs.quartier?.trim() || null,
    p_ville: champs.ville?.trim() || null,
    p_whatsapp: normaliserWhatsapp(champs.telephoneWhatsapp),
    p_metier: null,
    p_description_prestation: null,
    p_categorie_etablissement: null,
    p_type_boutique: null,
  });
  if (error) throw new Error(error.message);
}

/** Boutique visible ou masquée sur le Marketplace. */
export async function definirVisibiliteBoutique(storeId: string, actif: boolean): Promise<void> {
  const { error } = await supabase.rpc('definir_visibilite_boutique', { p_id: storeId, p_actif: actif });
  if (error) throw new Error(error.message);
}

export async function publierArticle(
  storeId: string,
  champs: { titre: string; categorie: string; prixXof: number; quantite: number; description?: string; photos: string[] }
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
  });
  if (error) throw new Error(error.message);
  return data as string;
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

  const reponse = await fetch(resultat.uri);
  const blob = await reponse.blob();
  const nom = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

  const { error } = await supabase.storage.from(BUCKET_PHOTOS).upload(nom, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw new Error(`Envoi de la photo impossible : ${error.message}`);
  return nom;
}

export { urlPhoto };
