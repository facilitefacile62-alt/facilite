// Regroupement des boutiques proches (vue 3D photo) : deux boutiques à 100 m ou moins l'une de l'autre sont dans le même groupe, de proche en proche (comme sur la carte 2D du site).
// Le regroupement est GÉOGRAPHIQUE : il ne dépend pas du zoom, donc une épingle de groupe reste la même (même place, même taille) à tous les niveaux.
// Pur et sans dépendance : testé dans tests/unit/carte-3d-photo.spec.js.

export const SEUIL_GROUPE_M = 100;

/** Distance approximative en mètres entre deux points (projection locale, suffisante à l'échelle de 100 m). */
export function distanceMetres(a, b) {
  const kLat = 111320;
  const kLng = 111320 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.hypot((a.lat - b.lat) * kLat, (a.lng - b.lng) * kLng);
}

/** Groupes de boutiques (tableaux), dans l'ordre d'apparition ; une boutique seule forme un groupe d'un élément. Les boutiques sans position valide sont ignorées. */
export function grouperBoutiques(boutiques, seuilM = SEUIL_GROUPE_M) {
  const liste = (boutiques || []).filter((b) => Number.isFinite(b?.lat) && Number.isFinite(b?.lng));
  const parent = liste.map((_, i) => i);
  const racine = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (let i = 0; i < liste.length; i++) {
    for (let j = i + 1; j < liste.length; j++) {
      if (distanceMetres(liste[i], liste[j]) <= seuilM) parent[racine(i)] = racine(j);
    }
  }
  const parRacine = new Map();
  liste.forEach((b, i) => {
    const r = racine(i);
    if (!parRacine.has(r)) parRacine.set(r, []);
    parRacine.get(r).push(b);
  });
  return [...parRacine.values()];
}

/** Centre (moyenne) d'un groupe : position de son épingle. */
export function centreGroupe(groupe) {
  const n = groupe.length || 1;
  return { lat: groupe.reduce((s, b) => s + b.lat, 0) / n, lng: groupe.reduce((s, b) => s + b.lng, 0) / n };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Regroupement selon le ZOOM : deux boutiques sont groupées quand leurs épingles seraient à moins de SEUIL_GROUPE_PX pixels à l'écran. Quand on zoome, les boutiques se séparent en épingles individuelles.
// Les boutiques à la MÊME position (ex. 3 boutiques de Pikine) ne peuvent pas se séparer par le zoom : leur épingle de groupe reste à tous les zooms ; leurs carrousels s'affichent l'un après l'autre dans le panneau fixe.

/** Distance en pixels en dessous de laquelle deux épingles sont regroupées. */
export const SEUIL_GROUPE_PX = 50;

/** Mètres par pixel CSS à un zoom MapLibre (tuiles de 512 px) et une latitude donnés. */
export function metresParPixel(zoom, lat) {
  return (78271.517 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

/** Groupes selon le zoom : le seuil en mètres vaut SEUIL_GROUPE_PX pixels à ce zoom. */
export function grouperBoutiquesEcran(boutiques, zoom, seuilPx = SEUIL_GROUPE_PX) {
  const liste = (boutiques || []).filter((b) => Number.isFinite(b?.lat) && Number.isFinite(b?.lng));
  if (!liste.length) return [];
  const latMoyenne = liste.reduce((s, b) => s + b.lat, 0) / liste.length;
  return grouperBoutiques(liste, seuilPx * metresParPixel(zoom, latMoyenne));
}

/** Clé stable d'un groupe (identifiants triés) : sert à reconnaître l'épingle sélectionnée. */
export function cleGroupe(membres) {
  return membres.map((b) => b.id).sort().join("+");
}

/** Signature d'un ensemble de groupes (ce qui est affiché) : la carte ne recrée ses épingles que si elle change. */
export function signatureGroupes(items) {
  return items.map((it) => cleGroupe(it.membres)).sort().join("|");
}

/** Groupes à afficher à un zoom donné : { sig, items: [{ membres }] }. */
export function calculerGroupesPhoto(boutiques, zoom) {
  const items = grouperBoutiquesEcran(boutiques, zoom).map((membres) => ({ membres }));
  return { sig: signatureGroupes(items), items };
}
