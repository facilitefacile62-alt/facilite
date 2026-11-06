// Recherche d'un point dans un arbre « 3D Tiles » (Google Photorealistic 3D Tiles), sans aucune dépendance et sans réseau : le chargement d'un tileset externe est injecté (voir TestGoogle3D.jsx), ce qui permet de tester l'algorithme
// avec une petite structure imaginaire (tests/unit/couverture-tuiles-3d.spec.js).
//
// Constat sur la vraie réponse de Google : les 4 enfants de la racine ont EXACTEMENT la même boîte (la Terre entière). Choisir « le premier enfant qui contient le point » menait donc à une impasse.
// L'algorithme explore tous les enfants qui contiennent le point, un par un (plus petite erreur géométrique d'abord), et revient en arrière quand une branche n'aboutit pas.

/** Seuil « maillage fin » : erreur géométrique (en mètres) à partir de laquelle on considère les bâtiments comme représentés en volume.
 *  Justification : l'erreur géométrique d'une tuile est l'écart maximal, en mètres, entre son maillage et la réalité. Un bâtiment courant fait 8 à 20 m de large : au-delà de ~32 m d'écart il disparaît dans le relief,
 *  en dessous les volumes commencent à se distinguer (et chaque niveau divise l'erreur par 2 : 32 m est atteint au niveau précédant 16 m, 8 m…). Ce n'est pas la valeur finale du rendu, seulement la preuve qu'on atteint le détail bâti. */
export const SEUIL_FIN_M = 32;

/** Colonne verticale testée au-dessus du point : le sol réel n'est pas à 0 m de hauteur ellipsoïdale (WGS84) — environ 40 m à Dakar, 50 à 80 m à Paris — et les boîtes fines ont un demi-axe vertical très court
 *  (quelques dizaines de mètres) : à 0 m, un point bien placé sort de la boîte de quelques pour cent. Une boîte est donc retenue si elle contient le point à AU MOINS UNE hauteur de cet intervalle. */
export const HAUTEUR_MIN_M = -50;
export const HAUTEUR_MAX_M = 400;

/** Direction « verticale » (normale à l'ellipsoïde) au point : le point à la hauteur h vaut exactement p0 + h * normale. */
export function normale(latDeg, lngDeg) {
  const la = (latDeg * Math.PI) / 180, lo = (lngDeg * Math.PI) / 180;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
}

export function versEcef(latDeg, lngDeg) {
  const a = 6378137, f = 1 / 298.257223563, e2 = f * (2 - f);
  const la = (latDeg * Math.PI) / 180, lo = (lngDeg * Math.PI) / 180;
  const n = a / Math.sqrt(1 - e2 * Math.sin(la) ** 2);
  return [n * Math.cos(la) * Math.cos(lo), n * Math.cos(la) * Math.sin(lo), n * (1 - e2) * Math.sin(la)];
}

// Matrice 4x4 stockée colonne par colonne (convention 3D Tiles).
function appliquer(m, v, point) {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + (point ? m[12] : 0),
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + (point ? m[13] : 0),
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + (point ? m[14] : 0),
  ];
}
export function produit(a, b) {
  const r = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let l = 0; l < 4; l++) for (let k = 0; k < 4; k++) r[c * 4 + l] += a[k * 4 + l] * b[c * 4 + k];
  return r;
}
export const IDENTITE = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export function typeVolume(t) {
  const bv = t?.boundingVolume;
  return bv?.region ? "region" : bv?.box ? "box" : bv?.sphere ? "sphere" : "aucun";
}

/** Projection du point sur chacun des 3 demi-axes de la boîte orientée (dedans si les trois valent au plus 1 en valeur absolue). */
export function rapports(tuile, m, p) {
  const b = tuile?.boundingVolume?.box;
  if (!b) return null;
  const c = appliquer(m, b.slice(0, 3), true);
  const axes = [b.slice(3, 6), b.slice(6, 9), b.slice(9, 12)].map((x) => appliquer(m, x, false));
  const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
  return axes.map((u) => {
    const n2 = u[0] * u[0] + u[1] * u[1] + u[2] * u[2];
    return n2 === 0 ? null : Math.round(((d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / n2) * 1e6) / 1e6;
  });
}

/**
 * Intervalle de hauteurs ellipsoïdales [h0, h1] (borné à HAUTEUR_MIN_M..HAUTEUR_MAX_M) pour lesquelles le point de la colonne est dans la tuile, ou null s'il n'y en a aucune.
 * Exact et sans échantillonnage : pour une boîte orientée, chaque rapport de projection est une fonction affine de la hauteur (a + b*h), donc chaque demi-axe donne un intervalle, et on les intersecte.
 * Un volume inconnu (sphère, absent) est traité comme « contient » pour ne jamais couper une branche à tort ; le type est signalé dans le diagnostic.
 */
export function intervalleHauteur(tuile, m, lieu, p, bornes = [HAUTEUR_MIN_M, HAUTEUR_MAX_M]) {
  let h0 = bornes[0], h1 = bornes[1];
  const bv = tuile?.boundingVolume;
  if (bv?.region) {
    const [o, s, e, n, hMin, hMax] = bv.region;
    const la = (lieu.lat * Math.PI) / 180, lo = (lieu.lng * Math.PI) / 180;
    if (!(lo >= o && lo <= e && la >= s && la <= n)) return null;
    if (Number.isFinite(hMin)) h0 = Math.max(h0, hMin);
    if (Number.isFinite(hMax)) h1 = Math.min(h1, hMax);
    return h0 <= h1 ? [h0, h1] : null;
  }
  if (!bv?.box) return [h0, h1];
  const b = bv.box;
  const c = appliquer(m, b.slice(0, 3), true);
  const axes = [b.slice(3, 6), b.slice(6, 9), b.slice(9, 12)].map((x) => appliquer(m, x, false));
  const nv = normale(lieu.lat, lieu.lng);
  const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
  for (const u of axes) {
    const n2 = u[0] * u[0] + u[1] * u[1] + u[2] * u[2];
    if (n2 === 0) continue;
    const a = (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / n2; // rapport à la hauteur 0
    const k = (nv[0] * u[0] + nv[1] * u[1] + nv[2] * u[2]) / n2; // variation du rapport par mètre de hauteur
    const tol = 1.0001;
    if (Math.abs(k) < 1e-15) {
      if (Math.abs(a) > tol) return null;
      continue;
    }
    const x1 = (-tol - a) / k, x2 = (tol - a) / k;
    h0 = Math.max(h0, Math.min(x1, x2));
    h1 = Math.min(h1, Math.max(x1, x2));
    if (h0 > h1) return null;
  }
  return [h0, h1];
}

/** Vrai si la colonne verticale du point traverse la tuile. */
export function contient(tuile, m, lieu, p) {
  return intervalleHauteur(tuile, m, lieu, p) !== null;
}

/** Adresse du contenu d'une tuile : « content » (1.0) ou « contents » (1.1, plusieurs contenus). */
export function adresseContenu(t) {
  return t?.content?.uri ?? t?.content?.url ?? t?.contents?.[0]?.uri ?? t?.contents?.[0]?.url ?? null;
}
export const estModele = (u) => /\.(glb|gltf|b3dm|i3dm|pnts)(\?|$)/i.test(u);
export const erreurTxt = (g) => (g == null ? "?" : g >= 1e10 ? "infinie" : `${Math.round(g * 10) / 10} m`);

export function resumeTuile(t) {
  const u = adresseContenu(t);
  return `volume « ${typeVolume(t)} », ${(t.children || []).length} enfant(s), contenu : ${u ? (estModele(u) ? "modèle" : "tileset externe") : "aucun"}, erreur ${erreurTxt(t.geometricError)}`;
}

/**
 * Cherche, par parcours en profondeur avec retour arrière, le modèle le plus fin qui couvre le point.
 *  - racine : le champ « root » du tileset de départ ;
 *  - ouvrir(uri) : charge un tileset externe et renvoie son JSON (c'est là que la clé et la session sont gérées, jamais ici) ;
 *  - restantes() : nombre de requêtes encore permises. Une requête est gardée en réserve (téléchargement du modèle de contrôle) : on n'ouvre plus de tileset quand il n'en reste qu'une.
 * Renvoie { meilleur: { uri, ge, chemin, prof, hauteur, intervalle } | null, plafond, ouverts } (hauteur = hauteur ellipsoïdale au milieu de l'intervalle compatible dans la dernière tuile) ; « chemin » = indices d'enfants suivis depuis la racine.
 */
export async function chercherTuile({ racine, lieu, ouvrir, restantes, surLigne = () => {}, surEvaluation = () => {}, surTileset = () => {} }) {
  const p = versEcef(lieu.lat, lieu.lng);
  let meilleur = null, plafond = false, ouverts = 0;
  const prefixe = (a, b) => b.every((x, i) => a[i] === x);

  async function explorer(tuile, mt, chemin, prof, inter) {
    if (prof > 60) return;
    const uri = adresseContenu(tuile);
    if (uri && estModele(uri) && (!meilleur || prof > meilleur.prof)) meilleur = { uri, ge: tuile.geometricError, chemin: chemin.slice(), prof, hauteur: inter ? Math.round(((inter[0] + inter[1]) / 2) * 10) / 10 : null, intervalle: inter ? inter.map((x) => Math.round(x * 10) / 10) : null };
    if (uri && !estModele(uri)) {
      if (restantes() <= 1) { plafond = true; return; }
      const sous = await ouvrir(uri);
      ouverts++;
      surTileset(sous);
      const ms = produit(mt, sous.root.transform || IDENTITE);
      surLigne(`Tileset externe ${ouverts} ouvert (chemin ${chemin.join(" > ") || "racine"}) : ${resumeTuile(sous.root)}.`);
      const is = intervalleHauteur(sous.root, ms, lieu, p);
      if (is) await explorer(sous.root, ms, chemin, prof + 1, is);
      return;
    }
    const candidats = (tuile.children || [])
      .map((e, i) => {
        // Le « transform » d'une tuile s'applique à son volume, à son contenu et à ses enfants : composé avant le test.
        const me = produit(mt, e.transform || IDENTITE);
        const inter = intervalleHauteur(e, me, lieu, p);
        const ok = inter !== null;
        surEvaluation({ chemin: chemin.concat(i).join(">"), volume: typeVolume(e), aTransform: !!e.transform, rapportsAxesHauteur0: rapports(e, me, p), intervalleHauteurM: inter ? inter.map((x) => Math.round(x * 10) / 10) : null, dedans: ok });
        return { e, me, i, ok, inter };
      })
      .filter((x) => x.ok)
      .sort((a, b) => (a.e.geometricError ?? 1e300) - (b.e.geometricError ?? 1e300) || a.i - b.i);
    for (const x of candidats) {
      const c = chemin.concat(x.i);
      await explorer(x.e, x.me, c, prof + 1, x.inter);
      if (plafond) return;
      if (meilleur && prefixe(meilleur.chemin, c)) return; // cette branche a abouti : inutile d'essayer les frères
    }
  }

  await explorer(racine, produit(IDENTITE, racine.transform || IDENTITE), [], 0, [HAUTEUR_MIN_M, HAUTEUR_MAX_M]);
  return { meilleur, plafond, ouverts };
}

/** Verdict : COUVERT si un modèle fin (erreur <= SEUIL_FIN_M) est atteint ; PARTIEL si seul du grossier existe ; INDÉTERMINÉ si le plafond est atteint avant le détail fin ou sans modèle. */
export function verdictCouverture({ meilleur, plafond }) {
  if (meilleur && meilleur.ge <= SEUIL_FIN_M) return { code: "COUVERT", texte: `COUVERT : un modèle fin (erreur géométrique ${erreurTxt(meilleur.ge)}, seuil ${SEUIL_FIN_M} m) existe à cet endroit : bâtiments en volume probables.` };
  if (plafond) return { code: "INDETERMINE", texte: `INDÉTERMINÉ : plafond de requêtes atteint avant le détail fin (${meilleur ? `plus fine erreur vue ${erreurTxt(meilleur.ge)}` : "aucun modèle vu"}). Ne rien conclure sur le détail.` };
  if (meilleur) return { code: "PARTIEL", texte: `PARTIEL : l'arbre se termine sur des tuiles grossières (plus fine erreur ${erreurTxt(meilleur.ge)}, seuil ${SEUIL_FIN_M} m) : relief sans bâtiments probable.` };
  return { code: "AUCUNE_TUILE", texte: "AUCUNE TUILE DE MODÈLE : toutes les branches qui contiennent le point se terminent sans contenu 3D. À rapprocher du contrôle de Paris." };
}
