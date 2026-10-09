import { urlPhoto } from '@/lib/marketplace';
import { supabase } from '@/lib/supabase';

// Commandes Marketplace côté app native — port de src/lib/marketplaceData.js
// (web). Les écritures passent toutes par des RPC SECURITY DEFINER qui
// revérifient elles-mêmes l'identité (migrations 20261005100000 et suivantes) ;
// la lecture repose sur la RLS : un acheteur ne voit que ses commandes, un
// vendeur celles de sa boutique. Facilité ne gère aucun paiement : l'article
// et la livraison se règlent directement entre les personnes concernées.

export type StatutCommande =
  | 'en_attente_livreur'
  | 'assignee'
  | 'recuperee'
  | 'en_livraison'
  | 'livree_declaree'
  | 'livree'
  | 'annulee';

export type MoyenPaiement = 'wave' | 'om' | 'livraison';

export type MaCommande = {
  id: string;
  item_id: string;
  store_id: string;
  acheteur_id: string;
  quantite: number;
  prix_unitaire_xof: number;
  prix_total_xof: number;
  frais_livraison_xof: number;
  livraison_nom: string;
  livraison_telephone: string;
  livraison_adresse: string;
  moyen_paiement: MoyenPaiement;
  statut: StatutCommande;
  livreur_id: string | null;
  livreur_position_lat: number | null;
  livreur_position_lng: number | null;
  livreur_position_maj_le: string | null;
  created_at: string;
  item: { titre: string; photos?: unknown } | null;
  store?: { nom: string; quartier: string | null; ville: string | null } | null;
};

export const LIBELLES_STATUT: Record<StatutCommande, string> = {
  en_attente_livreur: "En attente d'un livreur",
  assignee: 'Livreur assigné',
  recuperee: 'Article récupéré chez le vendeur',
  en_livraison: 'En cours de livraison',
  livree_declaree: 'Livraison déclarée',
  livree: 'Livrée',
  annulee: 'Annulée',
};

export const LIBELLES_PAIEMENT: Record<MoyenPaiement, string> = {
  wave: 'Wave',
  om: 'Orange Money',
  livraison: 'À la livraison',
};

type Pastille = { libelle: string; fond: string; texte: string };

// Un même statut se dit différemment selon qui regarde : l'acheteur attend sa
// livraison, le vendeur prépare puis voit partir sa commande (maquettes 66 et
// 78). Les libellés génériques ci-dessus restent ceux du suivi détaillé.
const BLEU: Pick<Pastille, 'fond' | 'texte'> = { fond: '#DBEAFE', texte: '#1D4ED8' };
const VERT: Pick<Pastille, 'fond' | 'texte'> = { fond: '#D1FAE5', texte: '#047857' };
const AMBRE: Pick<Pastille, 'fond' | 'texte'> = { fond: '#FEF3C7', texte: '#B45309' };
const GRIS: Pick<Pastille, 'fond' | 'texte'> = { fond: '#E5E7EB', texte: '#374151' };
const ROUGE: Pick<Pastille, 'fond' | 'texte'> = { fond: '#FEE2E2', texte: '#B91C1C' };

export function pastilleAcheteur(statut: StatutCommande): Pastille {
  switch (statut) {
    case 'en_attente_livreur': return { libelle: "En attente d'un livreur", ...BLEU };
    case 'assignee': return { libelle: 'Livreur assigné', ...BLEU };
    case 'recuperee': return { libelle: 'Article récupéré', ...BLEU };
    case 'en_livraison': return { libelle: 'En livraison', ...BLEU };
    case 'livree_declaree': return { libelle: 'Livrée par le livreur', ...AMBRE };
    case 'livree': return { libelle: 'Reçue', ...VERT };
    case 'annulee': return { libelle: 'Annulée', ...GRIS };
  }
}

export function pastilleVendeur(statut: StatutCommande): Pastille {
  switch (statut) {
    case 'en_attente_livreur': return { libelle: 'Nouvelle', ...ROUGE };
    case 'assignee': return { libelle: 'En préparation', ...GRIS };
    case 'recuperee':
    case 'en_livraison': return { libelle: 'En livraison', ...BLEU };
    case 'livree_declaree':
    case 'livree': return { libelle: 'Livrée', ...VERT };
    case 'annulee': return { libelle: 'Annulée', ...GRIS };
  }
}

/** « Aujourd'hui 10:24 », « Hier », « 3 oct. » — repère de date des cartes de la maquette 78. */
export function dateRelativeCourte(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const aujourdhui = new Date();
  const debutJour = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const ecartJours = Math.round((debutJour(aujourdhui) - debutJour(d)) / 86_400_000);
  const heure = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (ecartJours === 0) return `Aujourd'hui ${heure}`;
  if (ecartJours === 1) return 'Hier';
  return jourMois(iso);
}

/** Première photo d'un article en URL publique, ou null. */
export function premierePhoto(photos: unknown): string | null {
  const liste = Array.isArray(photos) ? photos : [];
  const premiere = liste.find((p) => typeof p === 'string' && p) as string | undefined;
  return premiere ? urlPhoto(premiere) : null;
}

/**
 * Référence courte lisible d'une commande (« CMD-8F3A »), dérivée de son
 * identifiant : les maquettes 66 à 68 et 80 montrent une référence en tête de
 * carte, la table n'a pas de numéro séquentiel. Les quatre premiers
 * caractères suffisent pour retrouver la commande côté support, et la
 * référence est la même sur tous les écrans (acheteur, vendeur, livreur).
 */
export function refCommande(id: string, prefixe: 'CMD' | 'LIV' = 'CMD'): string {
  return `${prefixe}-${id.replace(/-/g, '').slice(0, 4).toUpperCase()}`;
}

/** « 4 oct. » — date courte des cartes de commande (maquette 66). */
export function jourMois(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mois = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  return `${d.getDate()} ${mois[d.getMonth()]}`;
}

/** Date ISO -> « 06/10/2026 21:05 » en heure locale (formatage manuel, sans Intl). */
export function dateCourte(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const deux = (n: number) => String(n).padStart(2, '0');
  return `${deux(d.getDate())}/${deux(d.getMonth() + 1)}/${d.getFullYear()} ${deux(d.getHours())}:${deux(d.getMinutes())}`;
}

// Couleur de pastille par statut : vert quand c'est terminé, ambre quand une
// action est attendue, gris quand la commande est close sans livraison.
export function couleurStatut(statut: StatutCommande): { fond: string; texte: string } {
  if (statut === 'livree') return { fond: '#D1FAE5', texte: '#047857' };
  if (statut === 'livree_declaree') return { fond: '#FEF3C7', texte: '#B45309' };
  if (statut === 'annulee') return { fond: '#F3F4F6', texte: '#6B7280' };
  return { fond: '#E0F2FE', texte: '#0369A1' };
}

const COLONNES = '*, item:marketplace_items(titre, photos), store:marketplace_stores(nom, quartier, ville)';

export async function creerCommandeMarketplace(champs: {
  itemId: string;
  quantite: number;
  livraisonNom: string;
  livraisonTelephone: string;
  livraisonAdresse: string;
  moyenPaiement: MoyenPaiement;
}): Promise<MaCommande> {
  const { data, error } = await supabase.rpc('creer_commande_marketplace', {
    p_item_id: champs.itemId,
    p_quantite: Math.max(1, Math.round(champs.quantite)),
    p_livraison_nom: champs.livraisonNom.trim(),
    p_livraison_telephone: champs.livraisonTelephone.trim(),
    p_livraison_adresse: champs.livraisonAdresse.trim(),
    p_moyen_paiement: champs.moyenPaiement,
    p_frais_livraison_xof: 0,
  });
  if (error) throw new Error(error.message);
  return data as MaCommande;
}

/** Une commande par son id (la RLS limite déjà à l'acheteur, au livreur ou au vendeur concernés). */
export async function chargerCommande(commandeId: string): Promise<MaCommande | null> {
  if (!commandeId) return null;
  const { data, error } = await supabase
    .from('marketplace_commandes')
    .select(COLONNES)
    .eq('id', commandeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as MaCommande) ?? null;
}

/** Commandes passées par l'acheteur courant, les plus récentes d'abord. */
export async function chargerMesCommandesAcheteur(userId: string): Promise<MaCommande[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('marketplace_commandes')
    .select(COLONNES)
    .eq('acheteur_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MaCommande[];
}

/** Commandes reçues sur une boutique (vue du vendeur), les plus récentes d'abord. */
export async function chargerCommandesBoutique(storeId: string): Promise<MaCommande[]> {
  if (!storeId) return [];
  const { data, error } = await supabase
    .from('marketplace_commandes')
    .select(COLONNES)
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MaCommande[];
}

/** Acheteur : confirme avoir reçu le colis (livree_declaree -> livree). */
export async function confirmerReceptionCommande(commandeId: string): Promise<void> {
  const { error } = await supabase.rpc('confirmer_reception_commande', { p_commande_id: commandeId });
  if (error) throw new Error(error.message);
}

/** Acheteur : annule tant que personne n'a récupéré l'article. */
export async function annulerCommande(commandeId: string, motif: string | null = null): Promise<void> {
  const { error } = await supabase.rpc('annuler_commande_marketplace', {
    p_commande_id: commandeId,
    p_motif: motif,
  });
  if (error) throw new Error(error.message);
}
