// Logique PURE des variantes d'images publiées (affiches d'offres, visuels de stories). Aucun import externe.
//
// Pour chaque « <nom>-w1280.webp » du stockage il existe « <nom>-w960.webp » et « <nom>-w480.webp » (même convention que le site, voir src/lib/variantesImage.js).
// Une adresse qui ne suit pas ce nommage (image externe, ancienne image) n'a pas de variantes : elle est renvoyée telle quelle, sans risque de 404.

export type LargeurVariante = 480 | 960;

const MOTIF = /^(.*)-w1280\.webp(\?.*)?$/i;

/** Adresse de la variante demandée, ou l'adresse d'origine si elle n'a pas de variantes. */
export function urlVarianteImage(url: string, largeur?: LargeurVariante): string {
  if (!largeur || typeof url !== 'string') return url;
  const m = MOTIF.exec(url);
  return m ? `${m[1]}-w${largeur}.webp${m[2] ?? ''}` : url;
}
