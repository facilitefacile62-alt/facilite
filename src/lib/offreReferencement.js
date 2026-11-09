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

/**
 * Valeur ISO pour JobPosting.validThrough : la DATE LIMITE de l'offre, et rien d'autre. Sans date limite (ou date illisible) le champ est omis : la fin « publication +
 * 60 jours » de dateFinValidite sert à décider si une offre sort du référencement, mais n'est pas une date que l'employeur a annoncée, donc on ne la déclare pas à Google.
 */
export function validThroughIso(offre) {
  const limite = offre?.deadline;
  if (!limite) return undefined;
  const d = new Date(typeof limite === "string" && DATE_SEULE.test(limite.trim()) ? `${limite.trim()}T23:59:59.999Z` : limite);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Offre clôturée : statut de clôture, désactivée, ou date limite dépassée (la définition déjà utilisée par la liste et le bouton Postuler). */
export function offreCloturee(offre) {
  return isOfferExpired(offre);
}

/** Offre à ne plus proposer aux moteurs : clôturée, ou date de fin de validité dépassée (cas d'une offre ancienne sans date limite). */
export function offreHorsReferencement(offre, maintenant = Date.now()) {
  if (offreCloturee(offre)) return true;
  // Offre pas encore approuvée (en attente de modération) ou refusée : sa page directe ne doit ni émettre de JobPosting ni être indexée. Une offre sans statut
  // (offres de secours codées en dur) n'est pas concernée.
  if (offre && offre.status && offre.status !== "approved") return true;
  const fin = dateFinValidite(offre);
  return fin ? fin.getTime() < maintenant : false;
}

/**
 * Adresse du JobPosting à partir du champ « lieu » de l'offre (texte libre : « Dakar, Sénégal », « Tivaouane Peulh, Sénégal », « Sénégal »…). La ville est le premier
 * élément avant une virgule, une barre oblique, « & » ou une parenthèse ; « Sénégal » seul n'est pas une ville et n'est donc pas mis dans addressLocality. Les champs
 * rue et région, qui recopiaient avant le texte du lieu tel quel, sont supprimés : ils n'étaient pas vrais.
 */
export function adresseJobPosting(lieu) {
  const premier = String(lieu ?? "").split(/[,/&(]/)[0].replace(/\s+/g, " ").trim();
  const estLePays = /^s[ée]n[ée]gal$/i.test(premier);
  return {
    "@type": "PostalAddress",
    ...(premier && !estLePays ? { addressLocality: premier } : {}),
    addressCountry: "SN",
  };
}

/**
 * Ville d'une offre d'après son champ « lieu » (texte libre), pour les titres et descriptions : premier élément avant une virgule, une barre oblique, « & » ou
 * une parenthèse, sans « et ses environs », première lettre en capitale. « Sénégal » seul, « International » ou un lieu vide ne sont pas des villes : "".
 */
export function villeDuLieu(lieu) {
  const premier = String(lieu ?? "")
    .split(/[,/&(]/)[0]
    .replace(/\s+et\s+(?:ses\s+)?environs?.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!premier || /^(?:s[ée]n[ée]gal|international|multi-?pays)$/i.test(premier)) return "";
  return premier.charAt(0).toUpperCase() + premier.slice(1);
}
