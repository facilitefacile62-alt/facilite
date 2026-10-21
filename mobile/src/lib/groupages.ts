import { supabase } from '@/lib/supabase';

// Groupages Marketplace côté app native — port de src/lib/marketplaceData.js
// (web, fonctions « groupage »). Un livreur annonce une tournée (départ,
// destination, heure, places, prix) ; les acheteurs dont la commande va dans la
// même direction la rattachent à la tournée ; le livreur accepte ou refuse
// chaque commande avant de partir. Toutes les écritures passent par des RPC
// SECURITY DEFINER (migrations 20261015120000 et 20261015140000) qui revérifient
// l'identité, la distance, les places et les statuts : l'app ne fait que guider.
// Facilité ne gère aucun argent : le prix de la livraison se règle à la remise.

export type ZoneGroupage = { nom: string; lat: number; lng: number };

// Zones proposées à la place d'une carte à toucher (l'app n'a pas de sélection de
// point sur la carte) : centres approximatifs de quartiers et villes desservis
// par les livreurs. Le « Départ » peut aussi être la position actuelle.
export const ZONES_GROUPAGE: ZoneGroupage[] = [
  { nom: 'Dakar Plateau', lat: 14.6937, lng: -17.4441 },
  { nom: 'Médina', lat: 14.685, lng: -17.45 },
  { nom: 'Ouakam', lat: 14.7110, lng: -17.4880 },
  { nom: 'Almadies', lat: 14.745, lng: -17.526 },
  { nom: 'Yoff', lat: 14.756, lng: -17.468 },
  { nom: 'Parcelles Assainies', lat: 14.76, lng: -17.44 },
  { nom: 'Pikine', lat: 14.7549, lng: -17.3985 },
  { nom: 'Guédiawaye', lat: 14.7692, lng: -17.39 },
  { nom: 'Thiaroye', lat: 14.748, lng: -17.355 },
  { nom: 'Yeumbeul', lat: 14.77, lng: -17.35 },
  { nom: 'Keur Massar', lat: 14.7833, lng: -17.3167 },
  { nom: 'Malika', lat: 14.8, lng: -17.33 },
  { nom: 'Mbao', lat: 14.74, lng: -17.3 },
  { nom: 'Rufisque', lat: 14.7167, lng: -17.2667 },
  { nom: 'Diamniadio', lat: 14.7172, lng: -17.1833 },
  { nom: 'Thiès', lat: 14.791, lng: -16.9359 },
  { nom: 'Mbour', lat: 14.4198, lng: -16.964 },
];

export type Groupage = {
  id: string;
  livreur_id: string;
  depart_libelle: string;
  depart_lat: number;
  depart_lng: number;
  destination_libelle: string;
  destination_lat: number;
  destination_lng: number;
  heure_depart: string;
  places_max: number;
  frais_par_livraison_xof: number;
  rayon_depart_km: number;
  rayon_destination_km: number;
  note: string | null;
  statut: 'ouvert' | 'en_route' | 'termine' | 'annule';
};

export const LIBELLES_STATUT_GROUPAGE: Record<Groupage['statut'], string> = {
  ouvert: 'Ouvert',
  en_route: 'En route',
  termine: 'Terminé',
  annule: 'Annulé',
};

export type NouveauGroupage = {
  departLibelle: string;
  departLat: number;
  departLng: number;
  destinationLibelle: string;
  destinationLat: number;
  destinationLng: number;
  heureDepart: Date;
  placesMax: number;
  fraisXof: number;
  rayonDepartKm: number;
  rayonDestinationKm: number;
  note: string;
};

async function rpc<T>(nom: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(nom, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export function publierGroupage(g: NouveauGroupage): Promise<Groupage> {
  return rpc<Groupage>('publier_groupage', {
    p_depart_libelle: g.departLibelle,
    p_depart_lat: g.departLat,
    p_depart_lng: g.departLng,
    p_destination_libelle: g.destinationLibelle,
    p_destination_lat: g.destinationLat,
    p_destination_lng: g.destinationLng,
    p_heure_depart: g.heureDepart.toISOString(),
    p_places_max: g.placesMax,
    p_frais_xof: g.fraisXof,
    p_rayon_depart_km: g.rayonDepartKm,
    p_rayon_destination_km: g.rayonDestinationKm,
    p_note: g.note || null,
  });
}

export async function chargerMesGroupages(userId: string): Promise<Groupage[]> {
  const { data, error } = await supabase
    .from('marketplace_groupages')
    .select('*')
    .eq('livreur_id', userId)
    .order('heure_depart', { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as Groupage[];
}

export type CommandeDeGroupage = {
  id: string;
  item_titre: string;
  quantite: number;
  frais_livraison_xof: number;
  boutique_nom: string;
  boutique_quartier: string | null;
  groupage_decision: 'en_attente' | 'acceptee' | 'refusee' | null;
  statut: string;
  // Vides tant que le livreur n'a pas accepté la commande (confidentialité).
  acheteur_nom: string | null;
  acheteur_telephone: string | null;
  adresse: string | null;
};

export function listerCommandesDeMonGroupage(groupageId: string): Promise<CommandeDeGroupage[]> {
  return rpc<CommandeDeGroupage[]>('lister_commandes_de_mon_groupage', { p_groupage_id: groupageId }).then((l) => l ?? []);
}

export async function repondreCommandeGroupage(commandeId: string, accepter: boolean): Promise<void> {
  await rpc('repondre_commande_groupage', { p_commande_id: commandeId, p_accepter: accepter });
}
export async function demarrerGroupage(groupageId: string): Promise<void> {
  await rpc('demarrer_groupage', { p_groupage_id: groupageId });
}
export async function terminerGroupage(groupageId: string): Promise<void> {
  await rpc('terminer_groupage', { p_groupage_id: groupageId });
}
export async function annulerGroupage(groupageId: string): Promise<void> {
  await rpc('annuler_groupage', { p_groupage_id: groupageId });
}

export type GroupagePropose = {
  id: string;
  depart_libelle: string;
  depart_lat: number;
  depart_lng: number;
  destination_libelle: string;
  destination_lat: number;
  destination_lng: number;
  heure_depart: string;
  places_restantes: number;
  frais_par_livraison_xof: number;
  note: string | null;
  livreur_prenom: string | null;
  type_vehicule: string | null;
  distance_destination_km: number;
  dans_la_zone: boolean;
};

/** Tournées qui vont vers ce point (lieu de livraison de l'acheteur). Prénom du livreur seulement. */
export function rechercherGroupages(lat: number, lng: number): Promise<GroupagePropose[]> {
  return rpc<GroupagePropose[]>('rechercher_groupages', { p_lat: lat, p_lng: lng, p_rayon_km: 25, p_limite: 30 }).then((l) => l ?? []);
}

export async function rattacherCommandeAGroupage(commandeId: string, groupageId: string, lat: number, lng: number): Promise<void> {
  await rpc('rattacher_commande_a_groupage', { p_commande_id: commandeId, p_groupage_id: groupageId, p_lat: lat, p_lng: lng });
}

export async function detacherCommandeDeGroupage(commandeId: string): Promise<boolean> {
  return rpc<boolean>('detacher_commande_de_groupage', { p_commande_id: commandeId });
}

export type InfoGroupage = Pick<Groupage, 'id' | 'destination_libelle' | 'heure_depart' | 'statut' | 'frais_par_livraison_xof'>;

/** Destination, heure et statut des groupages auxquels mes commandes sont rattachées (RLS : ouverts et en route). */
export async function chargerGroupagesParIds(ids: (string | null | undefined)[]): Promise<Record<string, InfoGroupage>> {
  const liste = [...new Set(ids.filter((x): x is string => !!x))];
  if (liste.length === 0) return {};
  const { data, error } = await supabase
    .from('marketplace_groupages')
    .select('id, destination_libelle, heure_depart, statut, frais_par_livraison_xof')
    .in('id', liste);
  if (error) throw new Error(error.message);
  return Object.fromEntries(((data ?? []) as InfoGroupage[]).map((g) => [g.id, g]));
}

export function heureLisible(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
