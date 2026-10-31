// Place disponible pour les petits ronds de stories dans l'en-tête de l'Accueil : logique PURE (aucun import), testable seule.
//
// Sur un téléphone étroit, la bascule Facilité | Locaux, la loupe, la cloche et le menu (à droite) et le logo (à gauche) prennent presque toute la
// largeur : le conteneur des ronds se retrouvait à 0 px et les stories étaient CACHÉES par la bascule. On calcule donc ce qui tient vraiment :
// d'abord le nombre de ronds avec « ffacilite » à côté du logo ; si même un seul rond ne tient pas, on retire le mot « ffacilite » (le logo reste) pour
// laisser la place aux stories.

export const ROND = 26; // diamètre d'un rond de story
export const CHEVAUCHEMENT = 7; // recouvrement entre deux ronds
export const MAX_RONDS = 3;

const LOGO = 34;
const ECART_LOGO = 8;
const MOT = 88; // « ffacilite » en 19 px gras
const BASCULE = 64;
const LOUPE = 32;
const CLOCHE = 20;
const MENU = 22;
const GAP_DROITE = 8; // entre bascule, loupe, cloche, menu (3 écarts)
const PADDING = 12; // de chaque côté de l'en-tête
const GAP_LIGNE = 8; // entre logo, ronds et groupe de droite (2 écarts)
const MARGES_RONDS = 14; // marge gauche 10 + droite 4 du conteneur des ronds

/** Nombre de ronds qui tiennent dans `libre` pixels (0 si même un seul ne tient pas). */
export function rondsQuiTiennent(libre: number): number {
  if (libre < ROND) return 0;
  return Math.min(MAX_RONDS, 1 + Math.floor((libre - ROND) / (ROND - CHEVAUCHEMENT)));
}

export function placeStories(largeurEcran: number, rondsDisponibles: number): { ronds: number; sansMot: boolean } {
  const droite = BASCULE + LOUPE + CLOCHE + MENU + 3 * GAP_DROITE;
  const reste = largeurEcran - 2 * PADDING - 2 * GAP_LIGNE - MARGES_RONDS - droite;
  const avecMot = Math.min(rondsDisponibles, rondsQuiTiennent(reste - LOGO - ECART_LOGO - MOT));
  if (avecMot >= 1 || rondsDisponibles === 0) return { ronds: avecMot, sansMot: false };
  return { ronds: Math.min(rondsDisponibles, rondsQuiTiennent(reste - LOGO)), sansMot: true };
}
