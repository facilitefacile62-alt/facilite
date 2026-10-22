import { distanceKm, type Position } from '@/lib/marketplace';
import { supabase } from '@/lib/supabase';

// Boutiques affichées sur la carte « Autour de moi » (maquette 21).
//
// rechercher_boutiques_proches ne renvoie que les services et établissements ;
// les boutiques de produits n'y figurent pas. Les boutiques actives sont
// lisibles de tous (policy « actifs visibles de tous ») et peu nombreuses
// (9 le 09/10/2026) : on les lit directement, avec leur position, et on
// calcule la distance sur l'appareil. Une boutique sans position n'a pas de
// point à montrer et est écartée.
export type BoutiqueCarte = {
  id: string;
  nom: string;
  quartier: string | null;
  ville: string | null;
  typeBoutique: string;
  verifie: boolean;
  latitude: number;
  longitude: number;
  distanceKm: number | null;
  /** Paramètres de l'avatar façon Bitmoji (même `avatar_config` que le site). */
  avatarConfig: Record<string, unknown> | null;
  /** Vrai si la boutique a au moins un article actif en stock (filtre « En stock (LIVE) »). */
  enStock: boolean;
  /** Numéro WhatsApp / téléphone public de la boutique (carte du bas : Appeler, WhatsApp). */
  telephone: string | null;
};

export async function chargerBoutiquesCarte(depuis: Position | null): Promise<BoutiqueCarte[]> {
  const { data, error } = await supabase
    .from('marketplace_stores')
    .select('id, nom, quartier, ville, type_boutique, verifie, latitude, longitude, avatar_config, telephone_whatsapp')
    .eq('actif', true)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .limit(200);
  if (error) throw new Error(error.message);

  // Boutiques qui ont au moins un article actif en stock (une seule requête légère).
  const { data: enStockData } = await supabase.from('marketplace_items').select('store_id').eq('actif', true).gt('quantite', 0).limit(2000);
  const idsEnStock = new Set((enStockData ?? []).map((r) => r.store_id as string));

  const liste = (data ?? []).map((b) => ({
    id: b.id as string,
    nom: (b.nom as string) || 'Boutique',
    quartier: (b.quartier as string | null) ?? null,
    ville: (b.ville as string | null) ?? null,
    typeBoutique: (b.type_boutique as string) || 'produit',
    verifie: b.verifie === true,
    latitude: b.latitude as number,
    longitude: b.longitude as number,
    distanceKm: depuis ? distanceKm(depuis, { latitude: b.latitude as number, longitude: b.longitude as number }) : null,
    avatarConfig: (b.avatar_config as Record<string, unknown> | null) ?? null,
    enStock: idsEnStock.has(b.id as string),
    telephone: (b.telephone_whatsapp as string | null) ?? null,
  }));
  return liste.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
}
