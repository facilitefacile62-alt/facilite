// Placement ANTI-CHEVAUCHEMENT des épingles de la carte 3D (vues grise et photo) : chaque boutique garde sa propre épingle, à tous les zooms.
// Remplace le regroupement « N boutiques ». Tout se calcule en PIXELS à l'écran : quand on zoome, les boutiques qui ont assez de place reviennent à leur vraie position (aucun trait, aucun point) ;
// des boutiques exactement au même point restent écartées à tous les zooms. Pur et sans dépendance : testé dans tests/unit/ecartement-epingles.spec.js.
//
// Vocabulaire : (x, y) = position à l'écran de la POINTE d'une épingle (la boutique). L'épingle est une goutte de 44 × 56 px dont la pointe est en bas ; sa boîte occupe donc [x-22, x+22] × [y-56, y].
// Une épingle écartée garde un petit POINT sur sa vraie position, relié par un trait fin à sa pointe déplacée (décalage { dx, dy } en pixels).
//
// ALGORITHME (« éventail en lignes ») :
//  1. deux épingles se chevauchent si leurs boîtes (agrandies de 4 px de marge) se recouvrent ; les groupes de chevauchement sont les composantes connexes ;
//  2. une épingle sans chevauchement ne bouge pas (décalage nul) et devient un obstacle fixe ;
//  3. pour chaque groupe, on place les épingles en LIGNES CENTRÉES au-dessus du centre du groupe (pas de 48 px, première ligne à 46 px, lignes suivantes tous les 60 px), dans l'ordre gauche -> droite de leurs vraies
//     positions pour limiter les croisements de traits. Les épingles d'une ligne sont côte à côte : aucune n'en cache une autre, et le trait vers le point reste court ;
//  4. si cette disposition est impossible (obstacle, bord d'écran, zone interdite sous la recherche / le panneau / la bande de boutiques), repli GLOUTON : pour chaque épingle, la case libre la plus proche d'une grille
//     (lignes au-dessus ET au-dessous du centre, colonnes de part et d'autre), jamais en chevauchement avec une épingle déjà placée ni dans une zone interdite.

export const PIN = { l: 44, h: 56, marge: 4 };
const PAS_X = PIN.l + PIN.marge; // 48 px entre deux pointes d'une même ligne
const PAS_Y = PIN.h + PIN.marge; // 60 px entre deux lignes
const DECALAGE_HAUT = 46; // pointe de la 1re ligne au-dessus du point (le trait mesure ~46 px)
const DECALAGE_BAS = 62; // pointe d'une ligne sous le point : la boîte de 56 px ne doit pas recouvrir le point
export const PLAFOND_DEFAUT = 150;

const boite = (x, y) => ({ x0: x - PIN.l / 2 - PIN.marge / 2, x1: x + PIN.l / 2 + PIN.marge / 2, y0: y - PIN.h - PIN.marge / 2, y1: y + PIN.marge / 2 });
export const chevauche = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/** Vrai si deux épingles dont les pointes sont à (xa, ya) et (xb, yb) se recouvrent. */
export function epinglesSeChevauchent(xa, ya, xb, yb) {
  return chevauche(boite(xa, ya), boite(xb, yb));
}

function libre(b, obstacles, interdits, ecran) {
  if (ecran && (b.x0 < ecran.x0 || b.x1 > ecran.x1 || b.y0 < ecran.y0 || b.y1 > ecran.y1)) return false;
  for (const z of interdits) if (chevauche(b, z)) return false;
  for (const o of obstacles) if (chevauche(b, o)) return false;
  return true;
}

/**
 * @param {{ items: {id: string, x: number, y: number}[], interdits?: {x0,y0,x1,y1}[], ecran?: {x0,y0,x1,y1} }} p
 *   items : pointes (positions vraies) à l'écran ; interdits : rectangles où une épingle DÉPLACÉE ne doit pas aller (recherche, filtres, panneau, bande de boutiques, boutons) ;
 *   ecran : rectangle visible (une épingle déplacée y reste entière).
 * @returns {Map<string, { dx: number, dy: number, ecarte: boolean }>} un décalage par épingle (nul pour les épingles isolées)
 */
export function placerEpingles({ items, interdits = [], ecran = null }) {
  const liste = [...(items || [])].filter((i) => Number.isFinite(i?.x) && Number.isFinite(i?.y)).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const resultat = new Map(liste.map((i) => [i.id, { dx: 0, dy: 0, ecarte: false }]));
  const n = liste.length;
  if (n < 2) return resultat;

  // 1) composantes connexes de chevauchement (union-find)
  const boites = liste.map((i) => boite(i.x, i.y));
  const parent = liste.map((_, k) => k);
  const racine = (k) => {
    while (parent[k] !== k) {
      parent[k] = parent[parent[k]];
      k = parent[k];
    }
    return k;
  };
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) if (chevauche(boites[a], boites[b])) parent[racine(a)] = racine(b);
  const groupes = new Map();
  liste.forEach((_, k) => {
    const r = racine(k);
    if (!groupes.has(r)) groupes.set(r, []);
    groupes.get(r).push(k);
  });

  // 2) obstacles fixes : épingles isolées
  const obstacles = [];
  const aPlacer = [];
  for (const membres of groupes.values()) {
    if (membres.length === 1) obstacles.push(boites[membres[0]]);
    else aPlacer.push(membres);
  }
  aPlacer.sort((g1, g2) => (liste[g1[0]].id < liste[g2[0]].id ? -1 : 1));

  const largeurEcran = ecran ? ecran.x1 - ecran.x0 : 420;
  const parLigneMax = Math.max(2, Math.min(6, Math.floor((largeurEcran - 8) / PAS_X)));

  for (const membres of aPlacer) {
    const tries = [...membres].sort((a, b) => liste[a].x - liste[b].x || liste[a].y - liste[b].y || (liste[a].id < liste[b].id ? -1 : 1));
    const cx = tries.reduce((s, k) => s + liste[k].x, 0) / tries.length;
    const cy = tries.reduce((s, k) => s + liste[k].y, 0) / tries.length;
    const posees = [];
    const essaiLignes = () => {
      let restants = tries.length;
      let indice = 0;
      const placement = [];
      const boitesPosees = [];
      for (let ligne = 0; restants > 0; ligne++) {
        const nb = Math.min(restants, parLigneMax);
        const y = cy - DECALAGE_HAUT - ligne * PAS_Y;
        // ligne centrée sur le groupe, décalée pour rester entière dans l'écran
        let x0 = cx - ((nb - 1) / 2) * PAS_X;
        if (ecran) {
          const minX = ecran.x0 + PIN.l / 2 + PIN.marge / 2;
          const maxX = ecran.x1 - PIN.l / 2 - PIN.marge / 2;
          x0 = Math.min(Math.max(x0, minX), maxX - (nb - 1) * PAS_X);
        }
        for (let c = 0; c < nb; c++) {
          const x = x0 + c * PAS_X;
          const b = boite(x, y);
          if (!libre(b, obstacles, interdits, ecran) || boitesPosees.some((o) => chevauche(b, o))) return null;
          boitesPosees.push(b);
          placement.push({ k: tries[indice++], x, y });
        }
        restants -= nb;
      }
      return placement;
    };
    let placement = essaiLignes();
    if (!placement) {
      // repli glouton : case libre la plus proche d'une grille autour du centre, lignes au-dessus ET au-dessous
      const candidats = [];
      for (let i = -9; i <= 9; i++) {
        for (let j = 0; j <= 9; j++) {
          candidats.push({ x: cx + i * PAS_X, y: cy - DECALAGE_HAUT - j * PAS_Y });
          candidats.push({ x: cx + i * PAS_X, y: cy + DECALAGE_BAS + j * PAS_Y });
        }
      }
      candidats.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy) || a.x - b.x || a.y - b.y);
      placement = [];
      const boitesPosees = [];
      for (const k of tries) {
        const c = candidats.find((cand) => {
          const b = boite(cand.x, cand.y);
          return libre(b, obstacles, interdits, ecran) && !boitesPosees.some((o) => chevauche(b, o));
        });
        // dernier recours (zone totalement saturée) : on ignore les zones interdites mais jamais le chevauchement entre épingles
        const choix = c || candidats.find((cand) => {
          const b = boite(cand.x, cand.y);
          return !boitesPosees.some((o) => chevauche(b, o)) && !obstacles.some((o) => chevauche(b, o));
        }) || candidats[0];
        boitesPosees.push(boite(choix.x, choix.y));
        placement.push({ k, x: choix.x, y: choix.y });
      }
    }
    for (const p of placement) {
      posees.push(boite(p.x, p.y));
      resultat.set(liste[p.k].id, { dx: Math.round((p.x - liste[p.k].x) * 10) / 10, dy: Math.round((p.y - liste[p.k].y) * 10) / 10, ecarte: true });
    }
    obstacles.push(...posees);
  }
  return resultat;
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
