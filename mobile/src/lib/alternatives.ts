// Trajets alternatifs (« raccourcis ») : fonctions pures, sans dépendance (testables seules).
export type TrajetAvecAlternatives = { points: [number, number][]; distanceKm: number; dureeMin: number | null; alternatives?: Alternative[] };

export type Alternative = { points: [number, number][]; distanceKm: number; dureeMin: number | null };

/** « Même durée », « 2 min plus long », « 3 min plus court » : la différence d'une alternative avec le trajet principal. */
export function libelleDifference(principalMin: number | null, alternativeMin: number | null): string {
  if (principalMin == null || alternativeMin == null) return 'Autre trajet';
  const d = alternativeMin - principalMin;
  if (d === 0) return 'Même durée';
  return d > 0 ? `${d} min plus long` : `${-d} min plus court`;
}

/** Choisir une alternative : elle devient le trajet principal, l'ancien principal rejoint les alternatives. */
export function echangerAlternative<T extends TrajetAvecAlternatives>(trajet: T, index: number): T {
  const alts = trajet.alternatives ?? [];
  const choisie = alts[index];
  if (!choisie) return trajet;
  const ancien: Alternative = { points: trajet.points, distanceKm: trajet.distanceKm, dureeMin: trajet.dureeMin };
  return {
    ...trajet,
    points: choisie.points,
    distanceKm: choisie.distanceKm,
    dureeMin: choisie.dureeMin,
    alternatives: [...alts.slice(0, index), ancien, ...alts.slice(index + 1)],
  };
}

