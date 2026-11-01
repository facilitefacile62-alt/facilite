// Logique pure du carrousel plein écran des photos d'une carte (sans React, testable seule).

/** Index borné entre 0 et total - 1 ; 0 si la liste est vide. */
export function bornerIndex(i, total) {
  const n = Number(total) || 0;
  if (n <= 0) return 0;
  return Math.min(Math.max(Math.round(Number(i) || 0), 0), n - 1);
}

/** Photo suivante / précédente en boucle (la dernière revient à la première). */
export function indexSuivant(i, total) {
  const n = Number(total) || 0;
  return n <= 1 ? 0 : (bornerIndex(i, n) + 1) % n;
}
export function indexPrecedent(i, total) {
  const n = Number(total) || 0;
  return n <= 1 ? 0 : (bornerIndex(i, n) - 1 + n) % n;
}

/** Photo affichée d'après le défilement horizontal (chaque photo occupe toute la largeur). */
export function indexDepuisDefilement(scrollLeft, largeur, total) {
  const l = Number(largeur) || 0;
  if (l <= 0) return 0;
  return bornerIndex(Math.round((Number(scrollLeft) || 0) / l), total);
}

/** Adresses utilisables : chaînes non vides, sans doublon, dans l'ordre. */
export function photosDuCarrousel(photos) {
  const vues = new Set();
  const sortie = [];
  for (const p of Array.isArray(photos) ? photos : []) {
    if (typeof p !== "string") continue;
    const t = p.trim();
    if (!t || vues.has(t)) continue;
    vues.add(t);
    sortie.push(t);
  }
  return sortie;
}
