import { supabase } from '@/lib/supabase';

// Marketplace natif — port mobile de src/lib/marketplaceData.js (web) : mêmes
// tables (marketplace_items / marketplace_stores), mêmes filtres, même clé
// anon. Lecture publique : la RLS expose les boutiques et articles actifs à
// tout le monde (voir les policies "actifs visibles de tous").

export const BUCKET_PHOTOS = 'marketplace-photos';
export const SITE_URL = 'https://ffacilite.com';

// Identifiants = CHECK de marketplace_items.categorie (voir la migration
// 20260901200000_marketplace_categories.sql) : un écart produirait des filtres
// qui ne trouvent jamais rien.
export type CategorieMarketplace = { id: string; label: string; icone: string };
export const CATEGORIES_MARKETPLACE: CategorieMarketplace[] = [
  { id: 'telephones', label: 'Téléphones & Tech', icone: 'phone-portrait-outline' },
  { id: 'vehicules', label: 'Véhicules & Motos', icone: 'car-outline' },
  { id: 'immobilier', label: 'Immobilier', icone: 'home-outline' },
  { id: 'mode', label: 'Mode & Vêtements', icone: 'shirt-outline' },
  { id: 'maison', label: 'Maison & Électro', icone: 'bed-outline' },
  { id: 'electronique', label: 'Électronique & Son', icone: 'tv-outline' },
  { id: 'informatique', label: 'Informatique & PC', icone: 'laptop-outline' },
  { id: 'services', label: 'Services', icone: 'briefcase-outline' },
  { id: 'alimentation', label: 'Alimentation', icone: 'basket-outline' },
  { id: 'autre', label: 'Autre', icone: 'pricetag-outline' },
];

export function libelleCategorie(id: string | null | undefined): string {
  return CATEGORIES_MARKETPLACE.find((c) => c.id === id)?.label ?? 'Autre';
}

export type ArticleMarketplace = {
  id: string;
  titre: string;
  description: string;
  categorie: string;
  prixXof: number;
  quantite: number;
  statut: string;
  photos: string[];
  boutiqueId: string | null;
  boutiqueNom: string;
  quartier: string | null;
  ville: string | null;
  whatsapp: string | null;
  // Propriétaire de la boutique : destinataire de "Discuter sur la plateforme".
  proprietaireId: string | null;
  distanceKm: number | null;
};

export type Position = { latitude: number; longitude: number };
/** Rayon de "Autour de moi" : le même que sur le site. */
export const RAYON_PROCHE_KM = 10;

/** Chemin de stockage -> URL publique ; les URL déjà complètes sont conservées. */
export function urlPhoto(chemin: string | null | undefined): string | null {
  if (!chemin || typeof chemin !== 'string') return null;
  if (/^(https?:|data:)/.test(chemin)) return chemin;
  return supabase.storage.from(BUCKET_PHOTOS).getPublicUrl(chemin).data.publicUrl;
}

function listePhotos(brut: unknown): string[] {
  let liste: unknown = brut;
  if (typeof liste === 'string') {
    try {
      liste = JSON.parse(liste || '[]');
    } catch {
      liste = [liste];
    }
  }
  if (!Array.isArray(liste)) return [];
  return liste.map((p) => urlPhoto(typeof p === 'string' ? p : null)).filter((u): u is string => Boolean(u));
}

/** 15000 -> "15 000" (espace de milliers, sans dépendre de Intl sur Android). */
export function prixLisible(n: number): string {
  return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function enStock(article: Pick<ArticleMarketplace, 'statut' | 'quantite'>): boolean {
  return article.statut === 'en_stock' || Number(article.quantite) > 0;
}

type LigneStore = {
  id: string;
  nom: string;
  quartier: string | null;
  ville: string | null;
  telephone_whatsapp: string | null;
  owner_id: string | null;
};
type LigneArticle = {
  id: string;
  titre: string;
  description: string | null;
  categorie: string;
  prix_xof: number;
  quantite: number;
  statut: string;
  photos: unknown;
  store: LigneStore | LigneStore[] | null;
};

function versArticle(r: LigneArticle): ArticleMarketplace {
  const store = Array.isArray(r.store) ? r.store[0] : r.store;
  return {
    id: r.id,
    titre: r.titre,
    description: r.description || '',
    categorie: r.categorie,
    prixXof: r.prix_xof,
    quantite: r.quantite,
    statut: r.statut,
    photos: listePhotos(r.photos),
    boutiqueId: store?.id ?? null,
    boutiqueNom: store?.nom || 'Boutique',
    quartier: store?.quartier ?? null,
    ville: store?.ville ?? null,
    whatsapp: store?.telephone_whatsapp ?? null,
    proprietaireId: store?.owner_id ?? null,
    distanceKm: null,
  };
}

const COLONNES_STORE = 'id, nom, quartier, ville, telephone_whatsapp, owner_id';

/** Articles actifs de boutiques actives, plus récents d'abord (comme le web). */
export async function chargerArticles({
  categorie = null,
  texte = '',
  limite = 40,
}: {
  categorie?: string | null;
  texte?: string;
  limite?: number;
} = {}): Promise<ArticleMarketplace[]> {
  let requete = supabase
    .from('marketplace_items')
    .select(
      `id, titre, description, categorie, prix_xof, quantite, statut, photos, store:marketplace_stores!inner(${COLONNES_STORE})`
    )
    .eq('actif', true)
    .eq('store.actif', true)
    .order('updated_at', { ascending: false })
    .limit(limite);

  if (categorie) requete = requete.eq('categorie', categorie);
  const recherche = texte.trim();
  if (recherche) requete = requete.ilike('titre', `%${recherche.replace(/[%_]/g, ' ')}%`);

  const { data, error } = await requete;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as LigneArticle[]).map(versArticle);
}

type LigneProche = {
  id: string;
  titre: string;
  description: string | null;
  categorie: string;
  prix_xof: number;
  quantite: number;
  statut: string;
  photos: unknown;
  boutique_id: string | null;
  boutique_nom: string | null;
  quartier: string | null;
  ville: string | null;
  whatsapp: string | null;
  distance_km: number | null;
  boutique_owner_id: string | null;
};

/**
 * Articles triés du plus proche au plus éloigné. Le tri est fait par la base
 * (fonction rechercher_articles_proches, exécutable avec la clé publique),
 * comme sur le site : jamais en téléchargeant tout le catalogue.
 */
export async function chargerArticlesProches({
  position,
  categorie = null,
  texte = '',
  rayonKm = RAYON_PROCHE_KM,
  limite = 40,
}: {
  position: Position;
  categorie?: string | null;
  texte?: string;
  rayonKm?: number;
  limite?: number;
}): Promise<ArticleMarketplace[]> {
  const { data, error } = await supabase.rpc('rechercher_articles_proches', {
    p_lat: position.latitude,
    p_lng: position.longitude,
    p_rayon_km: rayonKm,
    p_categorie: categorie,
    p_texte: texte.trim() || null,
    p_en_stock: false,
    p_limite: limite,
  });
  if (error) throw new Error(error.message);

  return ((data ?? []) as LigneProche[]).map((r) => ({
    id: r.id,
    titre: r.titre,
    description: r.description || '',
    categorie: r.categorie,
    prixXof: r.prix_xof,
    quantite: r.quantite,
    statut: r.statut,
    photos: listePhotos(r.photos),
    boutiqueId: r.boutique_id,
    boutiqueNom: r.boutique_nom || 'Boutique',
    quartier: r.quartier,
    ville: r.ville,
    whatsapp: r.whatsapp,
    proprietaireId: r.boutique_owner_id,
    distanceKm: r.distance_km,
  }));
}

/** 0,85 -> "850 m" ; 3,4 -> "3,4 km" ; null -> null. */
export function distanceLisible(km: number | null | undefined): string | null {
  if (km === null || km === undefined || !Number.isFinite(km)) return null;
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m`;
  return `${(Math.round(km * 10) / 10).toString().replace('.', ',')} km`;
}

/** Un article par son identifiant (fiche produit). */
export async function obtenirArticle(id: string): Promise<ArticleMarketplace | null> {
  if (!id) return null;
  const { data, error } = await supabase
    .from('marketplace_items')
    .select(
      `id, titre, description, categorie, prix_xof, quantite, statut, photos, store:marketplace_stores(${COLONNES_STORE})`
    )
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return versArticle(data as unknown as LigneArticle);
}

/** "77 123 45 67" -> "+221771234567" ; null si rien d'exploitable. */
export function normaliserWhatsapp(saisie: string | null | undefined): string | null {
  const brut = String(saisie || '').replace(/[^0-9+]/g, '');
  if (!brut) return null;
  if (brut.startsWith('+')) return brut;
  if (brut.startsWith('221')) return `+${brut}`;
  if (brut.length === 9) return `+221${brut}`;
  return `+${brut}`;
}

export function lienArticle(id: string): string {
  return `${SITE_URL}/marketplace?article=${id}`;
}

/** Message qui nomme l'article, pour que le vendeur sache quel produit est visé. */
export function brouillonArticle(article: Pick<ArticleMarketplace, 'id' | 'titre' | 'prixXof'>): string {
  const titre = article.titre.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 120);
  const prix = article.prixXof > 0 ? ` (${prixLisible(article.prixXof)} FCFA)` : '';
  return [
    `Bonjour, je suis intéressé(e) par votre article « ${titre} »${prix}.`,
    `Lien : ${lienArticle(article.id)}`,
    'Est-il toujours disponible ?',
  ].join('\n');
}

export function lienWhatsapp(article: ArticleMarketplace): string | null {
  const numero = normaliserWhatsapp(article.whatsapp);
  if (!numero) return null;
  const texte = encodeURIComponent(brouillonArticle(article));
  return `https://wa.me/${numero.replace('+', '')}?text=${texte}`;
}

/** "Quartier, Ville" pour l'affichage, sans virgule orpheline. */
export function lieuBoutique(a: Pick<ArticleMarketplace, 'quartier' | 'ville'>): string {
  return [a.quartier, a.ville].filter(Boolean).join(', ') || 'Sénégal';
}
