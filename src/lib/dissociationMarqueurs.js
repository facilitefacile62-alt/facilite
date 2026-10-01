/**
 * Dissociation automatique de marqueurs superposés — calcul PUR (aucune
 * dépendance à Leaflet ni au DOM, donc testable en Node).
 *
 * Reçoit des positions en pixels ÉCRAN au zoom évalué et renvoie, pour
 * chacune, un décalage en pixels. Résultat = fonction déterministe de
 * (positions, échelle) : le même zoom donne toujours le même résultat, en
 * plein geste comme après le relâchement — c'est ce qui garantit qu'il n'y a
 * pas de saut à la fin d'un zoom.
 *
 * Règles (demande utilisateur, boutiques quasi confondues à Guinaw Rail Nord) :
 *  - seuil de regroupement = diamètre de l'avatar × échelle (avant : 26 px,
 *    soit la MOITIÉ d'un avatar : deux avatars qui se recouvraient à moitié
 *    n'étaient jamais séparés) ; regroupement transitif (A proche de B, B
 *    proche de C -> un seul groupe) ;
 *  - centre du groupe = barycentre de ses membres ;
 *  - un groupe de n membres se range sur un cercle de rayon
 *    R(n) = max(30, D / (2·sin(π/n))) × échelle : c'est le rayon minimal pour
 *    que deux voisins ne se recouvrent pas (l'ancien rayon fixe de 30 px
 *    laissait des avatars superposés dès 4 membres) ;
 *  - au-delà de 8 membres : anneaux concentriques, espacés d'un diamètre.
 */

// Avatar Explorer à l'échelle 1 : 52 px (w-13 h-13) × 1,15 = 60 px, + 4 px
// d'air. Le ×1,15 est la mise en avant de la boutique sélectionnée ET de
// celle qu'on survole (scale-115, appliqué autour du centre de TOUT le
// marqueur, ce qui décale aussi l'avatar de 1 à 2 px) : n'espacer que de
// 52 px laissait ces avatars agrandis mordre sur leurs voisins (mesuré :
// 58 px entre voisins pour 69 px d'avatar).
export const DIAMETRE_AVATAR_PX = 64;
// Badge "Vous êtes ici" : 76 px de large (mais plus étroit en hauteur et posé
// autour de son ancre, donc un voisin en diagonale le touche avant 76 px :
// mesuré 1 à 5 px de recouvrement) + 8 px d'air.
export const DIAMETRE_ICI_PX = 84;
export const RAYON_MIN_PX = 30;
export const CAPACITE_PREMIER_ANNEAU = 8;

/**
 * @param {Array<{id: string, x: number, y: number, ici?: boolean}>} points
 *   positions RÉELLES en pixels au zoom évalué.
 * @param {{echelle?: number}} options échelle des avatars pour ce zoom
 *   (echelleAvatarPourZoom).
 * @returns {{decalages: Map<string, {dx: number, dy: number}>, groupes: string[][]}}
 */
export function calculerDecalagesDissociation(points, { echelle = 1 } = {}) {
  // Le badge "Vous êtes ici" garde une taille fixe (il n'est pas redimensionné
  // avec le zoom, contrairement aux avatars des boutiques).
  const diametre = (p) => (p.ici ? DIAMETRE_ICI_PX : DIAMETRE_AVATAR_PX * echelle);

  const parent = points.map((_, i) => i);
  const racine = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const seuil = Math.max(diametre(points[i]), diametre(points[j]));
      if (Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) < seuil) {
        parent[racine(i)] = racine(j);
      }
    }
  }

  const parRacine = new Map();
  points.forEach((_, i) => {
    const r = racine(i);
    if (!parRacine.has(r)) parRacine.set(r, []);
    parRacine.get(r).push(i);
  });

  const decalages = new Map(points.map((p) => [p.id, { dx: 0, dy: 0 }]));
  const groupes = [];

  for (const indices of parRacine.values()) {
    if (indices.length < 2) continue;
    groupes.push(indices.map((i) => points[i].id));

    const cx = indices.reduce((s, i) => s + points[i].x, 0) / indices.length;
    const cy = indices.reduce((s, i) => s + points[i].y, 0) / indices.length;
    const dGroupe = Math.max(...indices.map((i) => diametre(points[i])));

    // Tri par angle autour du barycentre : les traits de rappel se croisent
    // le moins possible. Points parfaitement confondus (angle 0 pour tous) :
    // l'ordre d'entrée fait foi, donc résultat stable.
    const tries = indices
      .map((i) => ({ i, angle: Math.atan2(points[i].y - cy, points[i].x - cx) }))
      .sort((a, b) => a.angle - b.angle || a.i - b.i);

    const total = tries.length;
    const rayonPremierAnneau = Math.max(
      RAYON_MIN_PX * echelle,
      dGroupe / (2 * Math.sin(Math.PI / Math.min(total, CAPACITE_PREMIER_ANNEAU)))
    );

    let place = 0;
    let anneau = 0;
    while (place < total) {
      anneau += 1;
      const rayon = rayonPremierAnneau + (anneau - 1) * dGroupe;
      const capacite =
        anneau === 1
          ? Math.min(total, CAPACITE_PREMIER_ANNEAU)
          : Math.floor(Math.PI / Math.asin(Math.min(1, dGroupe / (2 * rayon))));
      const m = Math.min(capacite, total - place);
      // Anneaux pairs décalés d'un demi-pas : pas d'alignement radial.
      const phase = anneau % 2 === 0 ? Math.PI / m : 0;
      for (let k = 0; k < m; k++) {
        const angle = -Math.PI / 2 + phase + (2 * Math.PI * k) / m;
        const { i } = tries[place + k];
        decalages.set(points[i].id, {
          dx: cx + rayon * Math.cos(angle) - points[i].x,
          dy: cy + rayon * Math.sin(angle) - points[i].y,
        });
      }
      place += m;
    }
  }

  return { decalages, groupes };
}

/**
 * Sélection des boutiques affichées selon le zoom — même esprit que Google
 * Maps, qui réduit le nombre de points d'intérêt affichés en dézoomant et en
 * révèle progressivement plus en zoomant (demande explicite de
 * l'utilisateur, captures d'écran Google Maps à l'appui). Calcul PUR (aucune
 * dépendance à Leaflet), travaille directement en degrés lat/lng — une
 * approximation euclidienne suffit pour ce déclutter à l'échelle d'une
 * ville, pas besoin de la précision d'une formule haversine.
 *
 * Contrairement à calculerDecalagesDissociation ci-dessus (qui déplace des
 * marqueurs déjà affichés pour qu'ils ne se superposent pas visuellement à
 * l'écran), cette fonction décide en amont LESQUELS sont affichés — les deux
 * mécanismes sont complémentaires et agissent à des étapes différentes.
 *
 * @param {Array<{id: string, position: [number, number], estPremium?: boolean}>} boutiques
 * @param {number} zoom zoom Leaflet courant
 * @param {{zoomSansFiltre?: number, distanceBaseDegres?: number}} options
 *   zoomSansFiltre : à partir de ce niveau, toutes les boutiques sont
 *   affichées (14, même référence que echelleAvatarPourZoom). distanceBaseDegres :
 *   écart minimal (en degrés) entre deux boutiques retenues à zoomSansFiltre-1,
 *   doublé à chaque niveau de zoom en moins (0.0025° ≈ 250-280 m à la
 *   latitude de Dakar).
 * @returns {Array} sous-ensemble de `boutiques`, dans l'ordre d'origine.
 */
export function selectionnerBoutiquesVisibles(boutiques, zoom, { zoomSansFiltre = 14, distanceBaseDegres = 0.0025 } = {}) {
  if (!Array.isArray(boutiques) || boutiques.length === 0) return boutiques;
  if (!Number.isFinite(zoom) || zoom >= zoomSansFiltre) return boutiques;

  const distanceMin = distanceBaseDegres * Math.pow(2, zoomSansFiltre - zoom);

  // Les boutiques premium sont retenues en priorité (seul signal de mise en
  // avant réellement disponible aujourd'hui, voir boutiquesAffichees) ; au
  // sein d'un même rang, l'ordre d'origine fait foi pour un résultat stable
  // d'un rendu à l'autre.
  const ordreTri = boutiques
    .map((b, index) => ({ b, index }))
    .sort((x, y) => (y.b.estPremium ? 1 : 0) - (x.b.estPremium ? 1 : 0) || x.index - y.index);

  const retenues = [];
  for (const { b } of ordreTri) {
    const [lat, lng] = b.position || [];
    if (lat == null || lng == null) continue;
    const tropProche = retenues.some((r) => {
      const [rLat, rLng] = r.position;
      return Math.hypot(rLat - lat, rLng - lng) < distanceMin;
    });
    if (!tropProche) retenues.push(b);
  }

  // Ordre d'origine restauré : boutiquesAffichees fixe déjà l'ordre
  // d'affichage (carrousel, etc.), cette fonction ne doit que retirer des
  // éléments, jamais réordonner ce qui reste.
  const idsRetenus = new Set(retenues.map((b) => b.id));
  return boutiques.filter((b) => idsRetenus.has(b.id));
}
