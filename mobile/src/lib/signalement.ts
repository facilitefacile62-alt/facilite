import { supabase } from '@/lib/supabase';

// « Signaler cette annonce » — même fonction SQL que le site (signaler_annonce, src/lib/marketplaceData.js) et mêmes motifs (contrainte de la table
// marketplace_reports). La fonction refuse de signaler sa propre annonce, exige une connexion, garde un seul signalement par personne et par annonce, et ne dit
// jamais au vendeur qui l'a signalé : le message de confirmation le rappelle.

export const MOTIFS_SIGNALEMENT = [
  { id: 'inexistant', libelle: "L'article n'existe pas / plus" },
  { id: 'prix_trompeur', libelle: 'Le prix affiché est faux' },
  { id: 'contrefacon', libelle: 'Contrefaçon' },
  { id: 'interdit', libelle: 'Produit interdit ou dangereux' },
  { id: 'autre', libelle: 'Autre' },
] as const;

export type MotifSignalement = (typeof MOTIFS_SIGNALEMENT)[number]['id'];

/** Signale une annonce. Lève une erreur avec le message de la base (« Vous ne pouvez pas signaler votre propre annonce. », etc.). */
export async function signalerAnnonce(itemId: string, motif: MotifSignalement, details: string): Promise<void> {
  const { error } = await supabase.rpc('signaler_annonce', {
    p_item_id: itemId,
    p_motif: motif,
    p_details: details.trim() || null,
  });
  if (error) throw new Error(error.message);
}
