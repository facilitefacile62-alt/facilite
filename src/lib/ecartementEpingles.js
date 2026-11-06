// Épingles de la carte 3D (vues grise et photo) : chaque boutique garde sa propre épingle, FIXÉE À SON LIEU, sans trait ni point, qui bouge avec la carte comme un objet posé au sol.
// Deux étapes, dans cet ordre :
//
//  1. ESPACE RÉEL (en mètres, indépendant du zoom, stable d'un chargement à l'autre) : des boutiques qui se chevauchent à l'échelle de référence (zoom 18) ou qui ont exactement les mêmes coordonnées sont placées sur une
//     petite RANGÉE (grille compacte) de quelques mètres autour de leur point commun : 15 m entre deux épingles d'une même rangée (est-ouest), 18 m entre deux rangées (nord-sud), triées par identifiant.
//     Pourquoi 15 / 18 m : au zoom 18 (0,29 m par pixel à Dakar) une épingle de 44 × 56 px occupe 12,7 × 16,2 m ; 15 × 18 m garantit qu'aucune ne recouvre sa voisine dès ce zoom. Plus on zoome, plus elles se séparent à
//     l'écran. Le décalage en mètres ne dépend NI du zoom NI de l'ordre d'arrivée des données. Une boutique isolée n'est jamais déplacée.
//  2. PIXELS, MINIMAL (à faible zoom seulement) : si des têtes d'épingles se chevauchent encore à l'écran, chaque épingle est repoussée du minimum nécessaire pour que sa tête reste visible et cliquable (38 px entre
//     deux têtes), jamais plus de 44 px de son vrai lieu (une largeur d'épingle), jamais vers le haut (la tête ne monte pas au-dessus du lieu), jamais vers une zone interdite. Ce décalage diminue en zoomant et disparaît
//     dès qu'il y a la place. Aucun éventail lointain, aucun trait.
//
// Vocabulaire : (x, y) = position à l'écran de la POINTE d'une épingle (la boutique). L'épingle est une goutte de 44 × 56 px dont la pointe est en bas.
// Pur et sans dépendance : testé dans tests/unit/ecartement-epingles.spec.js.

export const PIN = { l: 44, h: 56, marge: 4 };
export const PLAFOND_DEFAUT = 150;

/** Espacement réel entre deux épingles d'une même rangée (est-ouest) et entre deux rangées (nord-sud), en mètres. */
export const ESPACEMENT_EST_M = 15;
export const ESPACEMENT_NORD_M = 18;
/** Deux têtes d'épingles ne doivent pas se recouvrir : distance minimale entre deux pointes (tête de ~34 px) et déplacement maximal en pixels (une largeur d'épingle). */
export const DISTANCE_TETES_PX = 38;
export const DEPLACEMENT_MAX_PX = 44;

const M_PAR_DEGRE = 111320;
const boite = (x, y) => ({ x0: x - PIN.l / 2 - PIN.marge / 2, x1: x + PIN.l / 2 + PIN.marge / 2, y0: y - PIN.h - PIN.marge / 2, y1: y + PIN.marge / 2 });
export const chevauche = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/** Vrai si deux épingles dont les pointes sont à (xa, ya) et (xb, yb) se recouvrent (boîtes de 44 × 56 px, marge de 4 px). */
export function epinglesSeChevauchent(xa, ya, xb, yb) {
  return chevauche(boite(xa, ya), boite(xb, yb));
}

/** Mètres (est, nord) -> degrés (longitude, latitude) à une latitude donnée. */
export function metresVersDegres(lat, estM, nordM) {
  return { dLat: nordM / M_PAR_DEGRE, dLng: estM / (M_PAR_DEGRE * Math.cos((lat * Math.PI) / 180)) };
}

/**
 * ÉTAPE 1 — décalage en mètres dans l'espace réel.
 * @param {{ id: string, lat: number, lng: number }[]} boutiques TOUTES les boutiques (pas seulement celles de la vue) : le résultat ne dépend alors ni des filtres ni du plafond ni du zoom.
 * @returns {Map<string, { lat: number, lng: number, decale: boolean, estM: number, nordM: number }>} position à utiliser pour chaque boutique (la vraie si isolée)
 */
export function decalerEnMetres(boutiques) {
  const liste = [...(boutiques || [])].filter((b) => Number.isFinite(b?.lat) && Number.isFinite(b?.lng)).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const n = liste.length;
  const resultat = new Map(liste.map((b) => [b.id, { lat: b.lat, lng: b.lng, decale: false, estM: 0, nordM: 0 }]));
  if (n < 2) return resultat;
  // Écarts en mètres entre deux positions, dans un repère LOCAL à la paire (aucun repère global : le résultat d'un amas ne dépend pas des autres boutiques).
  const ecartEst = (a, b) => (a.lng - b.lng) * M_PAR_DEGRE * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const ecartNord = (a, b) => (a.lat - b.lat) * M_PAR_DEGRE;
  const seChevauchent = (a, b) => Math.abs(ecartEst(a, b)) < ESPACEMENT_EST_M && Math.abs(ecartNord(a, b)) < ESPACEMENT_NORD_M;

  // Groupes (union-find) : au départ, les boutiques qui se chevauchent à l'échelle de référence à leurs VRAIES positions.
  const parent = liste.map((_, k) => k);
  const racine = (k) => {
    while (parent[k] !== k) {
      parent[k] = parent[parent[k]];
      k = parent[k];
    }
    return k;
  };
  const unir = (a, b) => {
    const ra = racine(a);
    const rb = racine(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) if (seChevauchent(liste[a], liste[b])) unir(a, b);

  // Pose chaque groupe de 2 boutiques ou plus sur sa grille compacte (rangée de 15 m, rangées espacées de 18 m, centrée sur le point commun, triée par identifiant).
  const poser = () => {
    const pos = liste.map((b) => ({ lat: b.lat, lng: b.lng, decale: false, estM: 0, nordM: 0 }));
    const groupes = new Map();
    liste.forEach((_, k) => {
      const r = racine(k);
      if (!groupes.has(r)) groupes.set(r, []);
      groupes.get(r).push(k);
    });
    for (const membres of groupes.values()) {
      if (membres.length < 2) continue;
      const tries = [...membres].sort((a, b) => (liste[a].id < liste[b].id ? -1 : 1));
      const m = tries.length;
      const cLat = tries.reduce((s2, k) => s2 + liste[k].lat, 0) / m;
      const cLng = tries.reduce((s2, k) => s2 + liste[k].lng, 0) / m;
      const colonnes = m <= 5 ? m : Math.ceil(Math.sqrt(m * 1.5));
      const rangees = Math.ceil(m / colonnes);
      tries.forEach((k, i) => {
        const col = i % colonnes;
        const rang = Math.floor(i / colonnes);
        const dansLaRangee = rang === rangees - 1 ? m - rang * colonnes : colonnes; // dernière rangée éventuellement plus courte, centrée
        const estM = (col - (dansLaRangee - 1) / 2) * ESPACEMENT_EST_M;
        const nordM = (rang - (rangees - 1) / 2) * ESPACEMENT_NORD_M;
        const { dLat, dLng } = metresVersDegres(cLat, estM, nordM);
        pos[k] = { lat: cLat + dLat, lng: cLng + dLng, decale: true, estM: Math.round(estM * 100) / 100, nordM: Math.round(nordM * 100) / 100 };
      });
    }
    return pos;
  };
  // Un amas posé peut empiéter sur un amas voisin (ou sur une boutique isolée proche) : on fusionne les groupes qui se chevauchent encore au zoom de référence et on repose, jusqu'à stabilité.
  let pos = poser();
  for (let tour = 0; tour < 30; tour++) {
    let fusion = false;
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        if (racine(a) !== racine(b) && seChevauchent(pos[a], pos[b])) {
          unir(a, b);
          fusion = true;
        }
      }
    }
    if (!fusion) break;
    pos = poser();
  }
  liste.forEach((b, k) => resultat.set(b.id, pos[k]));
  return resultat;
}

/**
 * ÉTAPE 2 — décalage minimal en pixels, à faible zoom.
 * @param {{ items: {id: string, x: number, y: number}[], interdits?: {x0,y0,x1,y1}[], distanceMin?: number, deplacementMax?: number }} p
 *   items : pointes à l'écran (positions de l'étape 1) ; interdits : rectangles (recherche, filtres, panneau, bande de boutiques, boutons) où une épingle déplacée ne doit pas aller.
 * @returns {Map<string, { dx: number, dy: number, ecarte: boolean }>} décalage en pixels par épingle (nul quand il y a la place)
 */
export function ecarterEnPixels({ items, interdits = [], distanceMin = DISTANCE_TETES_PX, deplacementMax = DEPLACEMENT_MAX_PX }) {
  const liste = [...(items || [])].filter((i) => Number.isFinite(i?.x) && Number.isFinite(i?.y)).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const n = liste.length;
  const dep = liste.map(() => ({ x: 0, y: 0 }));
  if (n >= 2) {
    const pos = (k) => ({ x: liste[k].x + dep[k].x, y: liste[k].y + dep[k].y });
    const borner = (k) => {
      // jamais vers le haut (la tête ne monte pas au-dessus du lieu) et jamais plus d'une largeur d'épingle du vrai lieu
      if (dep[k].y < 0) dep[k].y = 0;
      const d = Math.hypot(dep[k].x, dep[k].y);
      if (d > deplacementMax) {
        dep[k].x *= deplacementMax / d;
        dep[k].y *= deplacementMax / d;
      }
    };
    for (let tour = 0; tour < 80; tour++) {
      let bouge = false;
      for (let a = 0; a < n; a++) {
        for (let b = a + 1; b < n; b++) {
          const pa = pos(a);
          const pb = pos(b);
          let ux = pa.x - pb.x;
          let uy = pa.y - pb.y;
          const d = Math.hypot(ux, uy);
          if (d >= distanceMin - 0.25) continue;
          if (d < 0.01) {
            ux = 1; // confondues : séparation horizontale, la plus petite par ordre d'identifiant
            uy = 0;
          } else {
            ux /= d;
            uy /= d;
          }
          const pousse = (distanceMin - d) / 2 + 0.1;
          dep[a].x += ux * pousse;
          dep[a].y += uy * pousse;
          dep[b].x -= ux * pousse;
          dep[b].y -= uy * pousse;
          borner(a);
          borner(b);
          bouge = true;
        }
      }
      if (!bouge) break;
    }
    // zones interdites : si l'épingle déplacée y entre alors que sa vraie position n'y est pas, on réduit le décalage (moitié, quart, puis rien)
    for (let k = 0; k < n; k++) {
      if (!dep[k].x && !dep[k].y) continue;
      const vraie = boite(liste[k].x, liste[k].y);
      if (interdits.some((z) => chevauche(vraie, z))) continue;
      const gardeX = dep[k].x;
      const gardeY = dep[k].y;
      for (const f of [1, 0.5, 0.25, 0]) {
        const b = boite(liste[k].x + gardeX * f, liste[k].y + gardeY * f);
        if (!interdits.some((z) => chevauche(b, z))) {
          dep[k].x = gardeX * f;
          dep[k].y = gardeY * f;
          break;
        }
      }
    }
  }
  return new Map(liste.map((i, k) => [i.id, { dx: Math.trunc(dep[k].x * 10) / 10, dy: Math.trunc(dep[k].y * 10) / 10, ecarte: Boolean(Math.abs(dep[k].x) > 0.05 || Math.abs(dep[k].y) > 0.05) }]));
}

/**
 * Plafond de boutiques affichées dans la vue. Au-delà, on garde celles qui servent le plus (jamais de choix silencieux : l'appelant affiche un avis) :
 *  1. la boutique choisie (carrousel ouvert), 2. celles qui ont des articles EN STOCK, 3. celles qui ont le plus d'articles, 4. les plus proches du centre de l'écran, 5. l'ordre des identifiants (déterministe).
 * @param {{ id: string, x: number, y: number, enStock?: boolean, nbArticles?: number }[]} boutiques positions à l'écran
 * @returns {{ retenues: Set<string>, dansLaVue: number, masquees: number }}
 */
export function selectionnerVisibles(boutiques, { plafond = PLAFOND_DEFAUT, idChoisi = null, ecran, marge = 160 } = {}) {
  const l = ecran ? ecran.x1 - ecran.x0 : 0;
  const h = ecran ? ecran.y1 - ecran.y0 : 0;
  const dansVue = (boutiques || []).filter((b) => Number.isFinite(b?.x) && Number.isFinite(b?.y) && (!ecran || (b.x >= ecran.x0 - marge && b.x <= ecran.x1 + marge && b.y >= ecran.y0 - marge && b.y <= ecran.y1 + marge + PIN.h)));
  const cx = ecran ? ecran.x0 + l / 2 : 0;
  const cy = ecran ? ecran.y0 + h / 2 : 0;
  const classees = [...dansVue].sort((a, b) => {
    if ((a.id === idChoisi) !== (b.id === idChoisi)) return a.id === idChoisi ? -1 : 1;
    if (Boolean(a.enStock) !== Boolean(b.enStock)) return a.enStock ? -1 : 1;
    if ((b.nbArticles || 0) !== (a.nbArticles || 0)) return (b.nbArticles || 0) - (a.nbArticles || 0);
    const da = Math.hypot(a.x - cx, a.y - cy);
    const db = Math.hypot(b.x - cx, b.y - cy);
    if (da !== db) return da - db;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const retenues = new Set(classees.slice(0, Math.max(1, plafond)).map((b) => b.id));
  return { retenues, dansLaVue: dansVue.length, masquees: Math.max(0, dansVue.length - retenues.size) };
}
