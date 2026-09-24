/**
 * Affichage d'une image publiée, quel que soit son format.
 *
 * Miroir de src/lib/formatImage.js (site) : les deux projets sont séparés,
 * la règle est donc copiée — à garder identique des deux côtés.
 *
 * Règle : l'image est montrée AU RAPPORT QU'ELLE A (largeur / hauteur), sans
 * bandes sur les côtés, sans fond flou, et sans réglage demandé à la personne
 * qui publie. Seuls les formats extrêmes sont bornés (recadrage très léger,
 * jamais de bandes) ; ils restent visibles en entier dans la visionneuse.
 */

/** Plus haute admise : 1:2. */
export const RATIO_MIN = 0.5;
/** Plus large admise : 2,4:1. */
export const RATIO_MAX = 2.4;
/** Rapport de la zone d'attente pendant le chargement. */
export const RATIO_ATTENTE = 4 / 5;

/** Rapport à utiliser pour cadrer l'image, ou null tant que les dimensions sont inconnues. */
export function ratioAffichage(
  largeur: number | null | undefined,
  hauteur: number | null | undefined,
  min: number = RATIO_MIN,
  max: number = RATIO_MAX,
): number | null {
  const l = Number(largeur);
  const h = Number(hauteur);
  if (!Number.isFinite(l) || !Number.isFinite(h) || l <= 0 || h <= 0) return null;
  return Math.min(max, Math.max(min, l / h));
}
