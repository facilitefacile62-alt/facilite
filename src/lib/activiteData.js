"use client";

// Couche de données des activités métiers.
//
// Point Wave, pharmacie, clinique : trois métiers, un seul socle. Toutes les
// écritures passent par des fonctions SECURITY DEFINER — aucune table de ce
// dépôt n'accorde UPDATE ou DELETE à `authenticated` (invariant 1).
//
// Isolée du composant pour la même raison que marketplaceData : l'interface
// change souvent, ces règles non.

import { supabase } from "@/lib/supabase";

export const TYPES_ACTIVITE = [
  { id: "candidate", label: "Candidat", icone: "fa-user" },
  { id: "wave_point", label: "Point Wave", icone: "fa-mobile-screen" },
  { id: "pharmacy", label: "Pharmacie", icone: "fa-prescription-bottle-medical" },
  { id: "clinic", label: "Clinique", icone: "fa-stethoscope" },
];

export const STATUTS_PHARMACIE = [
  { id: "open", label: "Ouverte", couleur: "bg-emerald-500" },
  { id: "on_duty", label: "De garde", couleur: "bg-blue-600" },
  { id: "closed", label: "Fermée", couleur: "bg-gray-500" },
];

/** Profil d'activité de la personne connectée. */
export async function chargerMonActivite(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, activity_type, is_open, pharmacy_status, activity_latitude, activity_longitude, activity_position_definie_le, activity_updated_at, quartier, phone"
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Déclare son type d'activité. La position est facultative ici : elle peut
 * être posée au même moment ou plus tard.
 */
export async function definirMonActivite(type, position) {
  const { data, error } = await supabase.rpc("definir_mon_activite", {
    p_type: type,
    p_lat: position?.latitude ?? null,
    p_lng: position?.longitude ?? null,
  });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Bascule le statut en direct. Le point Wave passe un booléen, la pharmacie
 * un état — la base refuse le mauvais champ pour le mauvais métier plutôt que
 * de l'ignorer en silence.
 */
export async function basculerStatut({ isOpen = null, statut = null }) {
  const { data, error } = await supabase.rpc("majr_mon_statut", {
    p_is_open: isOpen,
    p_statut: statut,
  });
  if (error) throw new Error(error.message);
  return data;
}

/** Établissements ouverts autour d'un point, les ouverts d'abord. */
export async function etablissementsProches({ latitude, longitude, rayonKm = 10, type = null }) {
  const { data, error } = await supabase.rpc("etablissements_ouverts_proches", {
    p_lat: latitude,
    p_lng: longitude,
    p_rayon_km: rayonKm,
    p_type: type,
  });
  if (error) throw new Error(error.message);
  return (data || []).map((r) => ({
    ...r,
    distanceLisible: r.distance_km < 1 ? `${Math.round(r.distance_km * 1000)} m` : `${r.distance_km} km`,
  }));
}
