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
};

export async function chargerBoutiquesCarte(depuis: Position | null): Promise<BoutiqueCarte[]> {
  const { data, error } = await supabase
    .from('marketplace_stores')
    .select('id, nom, quartier, ville, type_boutique, verifie, latitude, longitude')
    .eq('actif', true)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .limit(200);
  if (error) throw new Error(error.message);

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
  }));
  return liste.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
}
