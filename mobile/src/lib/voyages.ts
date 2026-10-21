import { supabase } from '@/lib/supabase';

// Voyages (transport de passagers) côté app native — port des fonctions « voyage » de
// src/lib/marketplaceData.js (web). Un chauffeur VALIDÉ annonce un voyage ; des passagers y
// réservent des places ; le chauffeur accepte ou refuse chaque réservation ; les passagers
// acceptés suivent le chauffeur en direct. Toutes les écritures passent par des RPC
// SECURITY DEFINER (migration 20261015160000) qui revérifient identité, distance, places et
// statuts : l'app ne fait que guider. Facilité ne gère aucun argent : le prix par place se
// règle au chauffeur à la montée.

async function rpc<T>(nom: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(nom, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export function heureCourte(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Chauffeur : demande et profil
// ---------------------------------------------------------------------------
export type TypeVehiculeChauffeur = 'moto' | 'voiture' | 'minibus';
export const LIBELLES_VEHICULE_CHAUFFEUR: Record<TypeVehiculeChauffeur, string> = { moto: 'Moto', voiture: 'Voiture', minibus: 'Minibus' };

export type Chauffeur = {
  statut: 'actif' | 'suspendu';
  type_vehicule: string | null;
  marque_modele: string | null;
  immatriculation: string | null;
  places_passagers: number | null;
  motif_suspension: string | null;
};
export type DemandeChauffeur = { status: 'pending' | 'approved' | 'rejected'; rejection_reason: string | null };

export async function chargerMonStatutChauffeur(userId: string): Promise<{ chauffeur: Chauffeur | null; demande: DemandeChauffeur | null }> {
  const [c, d] = await Promise.all([
    supabase.from('chauffeurs').select('statut, type_vehicule, marque_modele, immatriculation, places_passagers, motif_suspension').eq('user_id', userId).maybeSingle(),
    supabase.from('chauffeurs_demandes').select('status, rejection_reason').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  return { chauffeur: (c.data as Chauffeur | null) ?? null, demande: (d.data as DemandeChauffeur | null) ?? null };
}

/** Dépose un justificatif dans le bucket PRIVÉ ; le premier dossier du chemin est l'id du demandeur (policy Storage). */
export async function envoyerDocumentChauffeur(uri: string, userId: string, extension: string, type: string): Promise<string> {
  if (!userId) throw new Error('Connexion requise.');
  const blob = await (await fetch(uri)).blob();
  const chemin = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const { error } = await supabase.storage.from('chauffeur-documents').upload(chemin, blob, { contentType: type, upsert: false });
  if (error) throw new Error(`Envoi du document impossible : ${error.message}`);
  return chemin;
}

export async function demanderDevenirChauffeur(c: {
  nomComplet: string;
  telephone: string;
  villeZone: string;
  typeVehicule: TypeVehiculeChauffeur;
  marqueModele: string;
  immatriculation: string;
  placesPassagers: number;
  documentUrls: string[];
}): Promise<void> {
  await rpc('demander_devenir_chauffeur', {
    p_nom_complet: c.nomComplet.trim(),
    p_telephone: c.telephone.trim(),
    p_ville_zone: c.villeZone.trim(),
    p_type_vehicule: c.typeVehicule,
    p_marque_modele: c.marqueModele.trim(),
    p_immatriculation: c.immatriculation.trim(),
    p_places_passagers: c.placesPassagers,
    p_document_urls: c.documentUrls,
  });
}

// ---------------------------------------------------------------------------
// Chauffeur : mes voyages
// ---------------------------------------------------------------------------
export type Voyage = {
  id: string;
  chauffeur_id: string;
  depart_libelle: string;
  depart_lat: number;
  depart_lng: number;
  destination_libelle: string;
  destination_lat: number;
  destination_lng: number;
  heure_depart: string;
  places_max: number;
  prix_par_place_xof: number;
  note: string | null;
  statut: 'ouvert' | 'en_route' | 'termine' | 'annule';
};
export const LIBELLES_STATUT_VOYAGE: Record<Voyage['statut'], string> = { ouvert: 'Ouvert', en_route: 'En route', termine: 'Terminé', annule: 'Annulé' };

export async function publierVoyage(v: {
  departLibelle: string;
  departLat: number;
  departLng: number;
  destinationLibelle: string;
  destinationLat: number;
  destinationLng: number;
  heureDepart: Date;
  placesMax: number;
  prixParPlaceXof: number;
  rayonPriseKm: number;
  rayonDestinationKm: number;
  note: string;
}): Promise<void> {
  await rpc('publier_voyage', {
    p_depart_libelle: v.departLibelle,
    p_depart_lat: v.departLat,
    p_depart_lng: v.departLng,
    p_destination_libelle: v.destinationLibelle,
    p_destination_lat: v.destinationLat,
    p_destination_lng: v.destinationLng,
    p_heure_depart: v.heureDepart.toISOString(),
    p_places_max: v.placesMax,
    p_prix_par_place_xof: v.prixParPlaceXof,
    p_rayon_prise_km: v.rayonPriseKm,
    p_rayon_destination_km: v.rayonDestinationKm,
    p_note: v.note || null,
  });
}

export async function chargerMesVoyages(userId: string): Promise<Voyage[]> {
  const res = await supabase.from('voyages').select('*').eq('chauffeur_id', userId).order('heure_depart', { ascending: false }).limit(20);
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as Voyage[];
}

export type ReservationDeMonVoyage = {
  id: string;
  places: number;
  prise_libelle: string;
  statut: 'en_attente' | 'acceptee' | 'refusee' | 'annulee';
  // Vides tant que le chauffeur n'a pas accepté la réservation (confidentialité).
  passager_nom: string | null;
  passager_telephone: string | null;
};
export function listerReservationsDeMonVoyage(voyageId: string): Promise<ReservationDeMonVoyage[]> {
  return rpc<ReservationDeMonVoyage[]>('lister_reservations_de_mon_voyage', { p_voyage_id: voyageId }).then((l) => l ?? []);
}
export async function repondreReservationVoyage(reservationId: string, accepter: boolean): Promise<void> {
  await rpc('repondre_reservation_voyage', { p_reservation_id: reservationId, p_accepter: accepter });
}
export async function demarrerVoyage(voyageId: string): Promise<void> {
  await rpc('demarrer_voyage', { p_voyage_id: voyageId });
}
export async function terminerVoyage(voyageId: string): Promise<void> {
  await rpc('terminer_voyage', { p_voyage_id: voyageId });
}
export async function annulerVoyage(voyageId: string): Promise<void> {
  await rpc('annuler_voyage', { p_voyage_id: voyageId });
}
export async function envoyerPositionVoyage(voyageId: string, lat: number, lng: number): Promise<void> {
  await rpc('mettre_a_jour_position_voyage', { p_voyage_id: voyageId, p_lat: lat, p_lng: lng });
}

// ---------------------------------------------------------------------------
// Passager
// ---------------------------------------------------------------------------
export type VoyagePropose = {
  id: string;
  depart_libelle: string;
  depart_lat: number;
  depart_lng: number;
  destination_libelle: string;
  destination_lat: number;
  destination_lng: number;
  heure_depart: string;
  places_restantes: number;
  prix_par_place_xof: number;
  note: string | null;
  chauffeur_prenom: string | null;
  type_vehicule: string | null;
  distance_prise_km: number;
  distance_destination_km: number;
  dans_la_zone: boolean;
};

export function rechercherVoyages(prise: { lat: number; lng: number }, dest: { lat: number; lng: number }): Promise<VoyagePropose[]> {
  return rpc<VoyagePropose[]>('rechercher_voyages', {
    p_prise_lat: prise.lat,
    p_prise_lng: prise.lng,
    p_dest_lat: dest.lat,
    p_dest_lng: dest.lng,
    p_rayon_km: 25,
    p_limite: 30,
  }).then((l) => l ?? []);
}

export async function reserverVoyage(r: {
  voyageId: string;
  places: number;
  priseLibelle: string;
  prise: { lat: number; lng: number };
  dest: { lat: number; lng: number };
}): Promise<void> {
  await rpc('reserver_voyage', {
    p_voyage_id: r.voyageId,
    p_places: r.places,
    p_prise_libelle: r.priseLibelle,
    p_prise_lat: r.prise.lat,
    p_prise_lng: r.prise.lng,
    p_dest_lat: r.dest.lat,
    p_dest_lng: r.dest.lng,
  });
}

export async function annulerReservationVoyage(reservationId: string): Promise<boolean> {
  return rpc<boolean>('annuler_reservation_voyage', { p_reservation_id: reservationId });
}

export type MaReservationVoyage = {
  id: string;
  voyage_id: string;
  places: number;
  prise_libelle: string;
  statut: 'en_attente' | 'acceptee' | 'refusee' | 'annulee';
};
export async function chargerMesReservationsVoyage(userId: string): Promise<MaReservationVoyage[]> {
  const { data, error } = await supabase
    .from('voyages_reservations')
    .select('id, voyage_id, places, prise_libelle, statut')
    .eq('passager_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return (data ?? []) as MaReservationVoyage[];
}

export type InfoVoyage = Pick<
  Voyage,
  'id' | 'depart_libelle' | 'depart_lat' | 'depart_lng' | 'destination_libelle' | 'destination_lat' | 'destination_lng' | 'heure_depart' | 'statut' | 'prix_par_place_xof'
>;
/** Voyages ouverts ou en route auxquels je suis rattaché (les voyages terminés ne sont plus lisibles). */
export async function chargerVoyagesParIds(ids: string[]): Promise<Record<string, InfoVoyage>> {
  const liste = [...new Set(ids.filter(Boolean))];
  if (liste.length === 0) return {};
  const { data, error } = await supabase
    .from('voyages')
    .select('id, depart_libelle, depart_lat, depart_lng, destination_libelle, destination_lat, destination_lng, heure_depart, statut, prix_par_place_xof')
    .in('id', liste);
  if (error) throw new Error(error.message);
  return Object.fromEntries(((data ?? []) as InfoVoyage[]).map((v) => [v.id, v]));
}

export type InfosChauffeur = { chauffeur_nom: string | null; telephone: string | null; type_vehicule: string | null; marque_modele: string | null; immatriculation: string | null };
/** Nom, téléphone, véhicule et plaque : renvoyés seulement une fois ma réservation acceptée. */
export async function infosChauffeurDeMaReservation(reservationId: string): Promise<InfosChauffeur | null> {
  const l = await rpc<InfosChauffeur[]>('infos_chauffeur_de_ma_reservation', { p_reservation_id: reservationId });
  return l && l[0] ? l[0] : null;
}

export async function chargerPositionVoyage(voyageId: string): Promise<{ lat: number; lng: number; maj_le: string } | null> {
  const { data, error } = await supabase.from('voyages_positions').select('lat, lng, maj_le').eq('voyage_id', voyageId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { lat: number; lng: number; maj_le: string } | null) ?? null;
}
