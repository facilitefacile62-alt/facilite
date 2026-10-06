import { supabase } from '@/lib/supabase';
import { SITE_URL, type Position } from '@/lib/marketplace';
import type { MaCommande } from '@/lib/commandes';

// Livreur Marketplace côté app native — port de src/lib/marketplaceData.js
// (web). Même principe que le reste : les changements d'état passent par des
// RPC SECURITY DEFINER qui revérifient l'identité ; la lecture repose sur la
// RLS (un livreur ne voit que les commandes qu'il a réclamées). Les
// coordonnées de l'acheteur ne sont jamais listées avant la réclamation.

export type TypeVehicule = 'pied' | 'velo' | 'moto' | 'voiture';

export const LIBELLES_VEHICULE: Record<TypeVehicule, string> = {
  pied: 'À pied',
  velo: 'Vélo',
  moto: 'Moto',
  voiture: 'Voiture',
};

export type LivreurActif = {
  statut: 'actif' | 'suspendu';
  type_vehicule: TypeVehicule;
  motif_suspension: string | null;
};

export type DemandeLivreur = {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
};

export type StatutLivreur = { livreur: LivreurActif | null; demande: DemandeLivreur | null };

export type LivraisonDisponible = {
  id: string;
  item_titre: string;
  quantite: number;
  prix_total_xof: number;
  frais_livraison_xof: number;
  boutique_nom: string;
  boutique_quartier: string | null;
  boutique_ville: string | null;
  boutique_lat: number | null;
  boutique_lng: number | null;
  distance_km: number | null;
  created_at: string;
};

export type LivraisonEnCours = MaCommande & {
  assignee_le: string | null;
  store: { nom: string; quartier: string | null; ville: string | null } | null;
};

export async function chargerMonStatutLivreur(userId: string): Promise<StatutLivreur> {
  if (!userId) return { livreur: null, demande: null };
  const [livreur, demande] = await Promise.all([
    supabase.from('livreurs').select('statut, type_vehicule, motif_suspension').eq('user_id', userId).maybeSingle(),
    supabase
      .from('livreurs_demandes')
      .select('id, status, rejection_reason, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (livreur.error) throw new Error(livreur.error.message);
  if (demande.error) throw new Error(demande.error.message);
  return {
    livreur: (livreur.data as LivreurActif | null) ?? null,
    demande: (demande.data as DemandeLivreur | null) ?? null,
  };
}

export async function demanderDevenirLivreur(champs: {
  nomComplet: string;
  telephone: string;
  villeZone: string;
  typeVehicule: TypeVehicule;
  documentUrls: string[];
}): Promise<void> {
  const { error } = await supabase.rpc('demander_devenir_livreur', {
    p_nom_complet: champs.nomComplet.trim(),
    p_telephone: champs.telephone.trim(),
    p_ville_zone: champs.villeZone.trim(),
    p_type_vehicule: champs.typeVehicule,
    p_document_urls: champs.documentUrls,
  });
  if (error) throw new Error(error.message);
}

const BUCKET_DOCUMENTS = 'livreur-documents';

/**
 * Dépose une pièce d'identité dans le bucket privé. Le premier dossier du
 * chemin est l'id du demandeur : la policy Storage l'exige (voir la migration
 * 20261005110000). Le fichier n'est lisible que par son auteur et les modérateurs.
 */
export async function envoyerDocumentLivreur(uri: string, userId: string, extension: string, type: string): Promise<string> {
  if (!userId) throw new Error('Connexion requise.');
  const reponse = await fetch(uri);
  const blob = await reponse.blob();
  const chemin = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET_DOCUMENTS).upload(chemin, blob, {
    contentType: type,
    upsert: false,
  });
  if (error) throw new Error(`Envoi du document impossible : ${error.message}`);
  return chemin;
}

export async function listerLivraisonsDisponibles(position: Position): Promise<LivraisonDisponible[]> {
  const { data, error } = await supabase.rpc('lister_livraisons_disponibles', {
    p_lat: position.latitude,
    p_lng: position.longitude,
    p_rayon_km: 15,
    p_limite: 40,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as LivraisonDisponible[];
}

export async function reclamerLivraison(commandeId: string): Promise<void> {
  const { error } = await supabase.rpc('reclamer_livraison', { p_commande_id: commandeId });
  if (error) throw new Error(error.message);
}

export async function chargerMesLivraisonsEnCours(userId: string): Promise<LivraisonEnCours[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('marketplace_commandes')
    .select('*, item:marketplace_items(titre), store:marketplace_stores(nom, quartier, ville)')
    .eq('livreur_id', userId)
    .in('statut', ['assignee', 'recuperee', 'en_livraison', 'livree_declaree'])
    .order('assignee_le', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LivraisonEnCours[];
}

/** Transitions du livreur assigné, une RPC par étape (aucune écriture directe). */
export type EtapeLivraison = 'recuperee' | 'demarrer' | 'livree' | 'liberer';

const RPC_ETAPE: Record<EtapeLivraison, string> = {
  recuperee: 'marquer_livraison_recuperee',
  demarrer: 'demarrer_livraison',
  livree: 'marquer_livraison_livree',
  liberer: 'liberer_livraison',
};

export async function faireEtapeLivraison(commandeId: string, etape: EtapeLivraison): Promise<void> {
  const { error } = await supabase.rpc(RPC_ETAPE[etape], { p_commande_id: commandeId });
  if (error) throw new Error(error.message);
}

/**
 * Envoie la position du livreur à l'API du site, qui applique la même limite
 * de débit et le même contrôle de zone (Sénégal) que sur le web. Le jeton
 * de session est transmis tel quel : l'API vérifie l'identité avant d'écrire.
 */
export async function envoyerPositionLivraison(commandeId: string, position: Position): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Session expirée.');
  const reponse = await fetch(`${SITE_URL}/api/marketplace/livraison-position`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ commandeId, lat: position.latitude, lng: position.longitude }),
  });
  if (!reponse.ok) {
    const corps = await reponse.json().catch(() => ({}));
    throw new Error(corps?.error || "Position non envoyée.");
  }
}
