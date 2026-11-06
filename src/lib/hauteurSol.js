// Hauteur de la surface de la photo sous un point (boutique), lue dans les BOÎTES ENGLOBANTES des tuiles affichées (aucune requête, aucune lecture de maillage).
//
// Pourquoi : les épingles sont des éléments HTML posés à une hauteur fixe ; la photo, elle, a un relief (sol + toits) à une hauteur au-dessus de l'ellipsoïde qui change d'un endroit à l'autre (≈ 52 m à Dakar Plateau, autre ailleurs).
// Méthode : parmi les tuiles affichées dont la boîte orientée est traversée par la verticale du point, on retient la plus FINE (plus petite erreur géométrique) ; la boîte enveloppe exactement le maillage de la tuile,
// donc le point où la verticale ENTRE dans la boîte (le bas) est le plus bas point du maillage de cette tuile : le sol de la rue, pas un toit. Valeurs en mètres au-dessus de l'ellipsoïde WGS84, comme celles du test de couverture.
// Limite : c'est le bas de la boîte de la tuile entière, pas la hauteur exacte du maillage sous le point (sur un terrain en pente dans la tuile, l'écart peut atteindre le dénivelé de la tuile).
import { IDENTITE, intervalleHauteur, versEcef } from "./couvertureTuiles3d.js";

/** Plage de hauteurs examinée (m au-dessus de l'ellipsoïde) : large, pour ne jamais couper la boîte d'une tuile. */
export const BORNES_HAUTEUR_SOL_M = [-500, 2000];

const matriceDe = (m) => (m && m.length === 16 ? Array.from(m) : IDENTITE);

/** { ge, bas, haut } de la tuile la plus fine traversée par la verticale du point, ou null. `tuiles` : tuiles loaders.gl (header.boundingVolume, computedTransform, lodMetricValue, content). */
export function hauteurSolSousPoint(tuiles, lieu) {
  const p = versEcef(lieu.lat, lieu.lng);
  let meilleur = null;
  for (const t of tuiles || []) {
    const bv = t?.header?.boundingVolume;
    const ge = t?.lodMetricValue ?? t?.header?.geometricError;
    if (!t?.content || !bv || !Number.isFinite(ge) || ge >= 1e10) continue;
    const inter = intervalleHauteur({ boundingVolume: bv }, matriceDe(t.computedTransform), lieu, p, BORNES_HAUTEUR_SOL_M);
    if (!inter) continue;
    if (!meilleur || ge < meilleur.ge) meilleur = { ge, bas: inter[0], haut: inter[1] };
  }
  return meilleur;
}

/** Hauteur d'ancrage d'une épingle dans la scène : sol lu (bas de la boîte) moins le décalage vertical appliqué aux tuiles ; null si aucune tuile ne couvre le point (l'appelant retombe sur 0 m). */
export function altitudeAncrage(lecture, decalageM) {
  if (!lecture || !Number.isFinite(lecture.bas)) return null;
  return lecture.bas - decalageM;
}
