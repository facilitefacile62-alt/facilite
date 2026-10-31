// Validité d'une offre pour les moteurs de recherche (JobPosting, plan du site, indexation). Logique pure, sans dépendance réseau.
// Règle : une offre a UNE date de fin fixe — sa date limite, ou à défaut sa date de publication + 60 jours. Cette date ne bouge jamais d'une
// visite à l'autre : une offre ancienne sans date limite finit donc par sortir du référencement au lieu de rester « valide » indéfiniment.
import { isOfferExpired } from "./offerExpiration.js";

export const JOURS_VALIDITE_SANS_DATE_LIMITE = 60;
const JOUR_MS = 24 * 60 * 60 * 1000;
const DATE_SEULE = /^\d{4}-\d{2}-\d{2}$/;

/** Date de fin de validité (objet Date), ou null si ni date limite ni date de publication exploitables. */
export function dateFinValidite(offre) {
  if (!offre) return null;
  const limite = offre.deadline;
  if (limite) {
    // « AAAA-MM-JJ » : l'offre reste ouverte toute la journée.
    const d = new Date(typeof limite === "string" && DATE_SEULE.test(limite.trim()) ? `${limite.trim()}T23:59:59.999Z` : limite);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const publiee = offre.created_at ? new Date(offre.created_at) : null;
  if (publiee && !Number.isNaN(publiee.getTime())) return new Date(publiee.getTime() + JOURS_VALIDITE_SANS_DATE_LIMITE * JOUR_MS);
  return null;
}

/** Valeur ISO pour JobPosting.validThrough, ou undefined si l'offre n'a aucune date exploitable (le champ est alors omis). */
export function validThroughIso(offre) {
  const d = dateFinValidite(offre);
  return d ? d.toISOString() : undefined;
}

/** Offre clôturée : statut de clôture, désactivée, ou date limite dépassée (la définition déjà utilisée par la liste et le bouton Postuler). */
export function offreCloturee(offre) {
  return isOfferExpired(offre);
}

/** Offre à ne plus proposer aux moteurs : clôturée, ou date de fin de validité dépassée (cas d'une offre ancienne sans date limite). */
export function offreHorsReferencement(offre, maintenant = Date.now()) {
  if (offreCloturee(offre)) return true;
  const fin = dateFinValidite(offre);
  return fin ? fin.getTime() < maintenant : false;
}
