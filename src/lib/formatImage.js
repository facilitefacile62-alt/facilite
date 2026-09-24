/**
 * Affichage d'une image publiée, quel que soit son format.
 *
 * Règle : l'image est montrée AU RAPPORT QU'ELLE A (largeur / hauteur), sans
 * bandes sur les côtés, sans fond flou, et sans que la personne qui publie ait
 * à régler quoi que ce soit — c'est la plateforme qui s'adapte.
 *
 * Seuls les formats extrêmes (bandeau très allongé, affiche géante de type
 * "défilé") sont bornés : au-delà, l'image prendrait tout l'écran ou
 * deviendrait une ficelle illisible. Ils sont alors recadrés très légèrement
 * (jamais de bandes) et restent visibles en entier dans la visionneuse
 * "Agrandir".
 */

/** Plus haute admise : 1:2 (largeur / hauteur = 0,5). */
export const RATIO_MIN = 0.5;
/** Plus large admise : 2,4:1 (bandeau panoramique). */
export const RATIO_MAX = 2.4;
/** Rapport de la zone d'attente pendant le chargement (évite un saut de page trop brutal). */
export const RATIO_ATTENTE = 4 / 5;

/**
 * Rapport à utiliser pour cadrer l'image.
 * @returns {number|null} null tant que les dimensions sont inconnues.
 */
export function ratioAffichage(largeur, hauteur, min = RATIO_MIN, max = RATIO_MAX) {
  const l = Number(largeur);
  const h = Number(hauteur);
  if (!Number.isFinite(l) || !Number.isFinite(h) || l <= 0 || h <= 0) return null;
  return Math.min(max, Math.max(min, l / h));
}
