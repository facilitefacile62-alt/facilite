// Logique PURE du glissement entre onglets : quand un mouvement du doigt est-il un geste horizontal ? Aucun import : testable seule.

export const DISTANCE_DEPART = 16; // le geste commence à prendre la main après ce déplacement horizontal
export const DISTANCE_VALIDATION = 70; // distance horizontale pour valider le changement d'onglet au relâchement

/**
 * `dx`, `dy` : déplacement du doigt. Avant le relâchement (`relache` = false) : le geste ne prend la main que s'il est franchement horizontal
 * (au moins deux fois plus horizontal que vertical), pour ne jamais gêner le défilement vertical. Au relâchement : renvoie le sens
 * ('gauche' = doigt vers la gauche, 'droite' = doigt vers la droite) si la distance suffit, sinon null.
 */
export function geste(dx: number, dy: number, relache: boolean): 'gauche' | 'droite' | null {
  const horizontal = Math.abs(dx);
  const vertical = Math.abs(dy);
  if (horizontal < (relache ? DISTANCE_VALIDATION : DISTANCE_DEPART)) return null;
  if (horizontal < vertical * 2) return null;
  return dx < 0 ? 'gauche' : 'droite';
}
