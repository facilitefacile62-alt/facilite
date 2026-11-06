const { test, expect } = require("@playwright/test");

// Placement anti-chevauchement des épingles (remplace le regroupement) : calcul pur, en pixels à l'écran.

async function lib() {
  return import("../../src/lib/ecartementEpingles.js");
}

const ECRAN = { x0: 0, y0: 0, x1: 420, y1: 800 };

// Position finale (pointe) d'une épingle = position vraie + décalage
function finales(items, res) {
  return items.map((i) => ({ id: i.id, x: i.x + res.get(i.id).dx, y: i.y + res.get(i.id).dy }));
}
function aucunChevauchement(pts, chevauche, boite) {
  for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++) if (chevauche(boite(pts[a].x, pts[a].y), boite(pts[b].x, pts[b].y))) return false;
  return true;
}

test("4 boutiques au même point : toutes présentes, écartées en ligne, aucune ne cache une autre", async () => {
  const { placerEpingles, epinglesSeChevauchent } = await lib();
  const items = ["masque", "facile demo", "Moïse Couture", "Ndiaye électrique"].map((id) => ({ id, x: 210, y: 500 }));
  const res = placerEpingles({ items, ecran: ECRAN });
  expect(res.size).toBe(4);
  expect([...res.values()].every((r) => r.ecarte)).toBe(true);
  const pts = finales(items, res);
  for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++) expect(epinglesSeChevauchent(pts[a].x, pts[a].y, pts[b].x, pts[b].y)).toBe(false);
  // ligne centrée au-dessus du point (éventail en ligne) : même hauteur, pas de 48 px, symétrique autour du point
  const ys = new Set(pts.map((p) => Math.round(p.y)));
  expect(ys.size).toBe(1);
  expect(pts[0].y).toBeLessThan(500);
  const xs = pts.map((p) => p.x).sort((a, b) => a - b);
  expect(xs[1] - xs[0]).toBeCloseTo(48, 5);
  expect((xs[0] + xs[3]) / 2).toBeCloseTo(210, 5);
});

test("une boutique isolée reste à sa vraie position, sans trait ni point", async () => {
  const { placerEpingles } = await lib();
  const res = placerEpingles({ items: [{ id: "seule", x: 100, y: 300 }, { id: "loin", x: 300, y: 600 }], ecran: ECRAN });
  expect(res.get("seule")).toEqual({ dx: 0, dy: 0, ecarte: false });
  expect(res.get("loin")).toEqual({ dx: 0, dy: 0, ecarte: false });
  expect(placerEpingles({ items: [{ id: "a", x: 5, y: 5 }] }).get("a").ecarte).toBe(false);
  expect(placerEpingles({ items: [] }).size).toBe(0);
});

test("au zoom suffisant, des boutiques proches reviennent à leur vraie position ; les boutiques au même point restent écartées", async () => {
  const { placerEpingles } = await lib();
  // deux boutiques à 25 m l'une de l'autre, et deux boutiques exactement au même point ; positions à l'écran à différents zooms (m/px)
  const monde = [{ id: "a", e: 0, n: 0 }, { id: "b", e: 25, n: 0 }, { id: "c", e: 400, n: 0 }, { id: "d", e: 400, n: 0 }];
  const ecranA = (mParPx) => monde.map((m) => ({ id: m.id, x: 100 + m.e / mParPx, y: 500 - m.n / mParPx }));
  // zoom bas (2 m/px) : a et b à 12 px l'une de l'autre => écartées
  let res = placerEpingles({ items: ecranA(2), ecran: ECRAN });
  expect(res.get("a").ecarte).toBe(true);
  expect(res.get("b").ecarte).toBe(true);
  // zoom haut (0,2 m/px) : a et b à 125 px l'une de l'autre => retour à la vraie position, sans trait ; c et d (confondues) restent écartées
  const immense = { x0: -1e5, y0: -1e5, x1: 1e5, y1: 1e5 };
  res = placerEpingles({ items: ecranA(0.2), ecran: immense });
  expect(res.get("a")).toEqual({ dx: 0, dy: 0, ecarte: false });
  expect(res.get("b")).toEqual({ dx: 0, dy: 0, ecarte: false });
  expect(res.get("c").ecarte).toBe(true);
  expect(res.get("d").ecarte).toBe(true);
  // à tous les zooms, c et d (même point) restent écartées l'une de l'autre (aucun chevauchement)
  for (const m of [4, 1, 0.2, 0.05, 0.01]) {
    const r = placerEpingles({ items: ecranA(m), ecran: immense });
    const pc = r.get("c");
    const pd = r.get("d");
    expect(Math.hypot(pc.dx - pd.dx, pc.dy - pd.dy)).toBeGreaterThanOrEqual(44);
    expect(pc.ecarte && pd.ecarte).toBe(true);
  }
});

test("aucune épingle déplacée ne va sous la recherche, les filtres, le panneau ou la bande de boutiques, ni hors de l'écran", async () => {
  const { placerEpingles, chevauche, PIN } = await lib();
  const interdits = [
    { x0: 0, y0: 0, x1: 420, y1: 130 }, // recherche + filtres
    { x0: 0, y0: 560, x1: 420, y1: 800 }, // panneau + bande de boutiques
    { x0: 340, y0: 120, x1: 420, y1: 260 }, // boutons 3D / PHOTO
  ];
  const boite = (x, y) => ({ x0: x - PIN.l / 2 - 2, x1: x + PIN.l / 2 + 2, y0: y - PIN.h - 2, y1: y + 2 });
  // 5 boutiques au même point, près du haut (la rangée du dessus passerait sous la recherche) puis près du bord droit
  for (const [x, y] of [[210, 200], [400, 300], [20, 300], [210, 540]]) {
    const items = Array.from({ length: 5 }, (_, k) => ({ id: `b${k}`, x, y }));
    const res = placerEpingles({ items, interdits, ecran: ECRAN });
    const pts = finales(items, res);
    expect(res.size).toBe(5);
    for (const p of pts) {
      const b = boite(p.x, p.y);
      expect(b.x0).toBeGreaterThanOrEqual(-3);
      expect(b.x1).toBeLessThanOrEqual(423);
      for (const z of interdits) expect(chevauche(b, z)).toBe(false);
    }
    expect(aucunChevauchement(pts, chevauche, boite)).toBe(true);
  }
});

test("150 boutiques : aucune épingle n'en cache une autre, calcul rapide et déterministe", async () => {
  const { placerEpingles, chevauche, PIN } = await lib();
  const boite = (x, y) => ({ x0: x - PIN.l / 2, x1: x + PIN.l / 2, y0: y - PIN.h, y1: y });
  // générateur pseudo-aléatoire fixe
  let graine = 12345;
  const alea = () => ((graine = (graine * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const items = [];
  // 10 amas de 8 boutiques (dont 3 amas exactement au même point) + 70 boutiques dispersées
  for (let c = 0; c < 10; c++) {
    const cx = 60 + alea() * 300;
    const cy = 200 + alea() * 400;
    for (let k = 0; k < 8; k++) items.push({ id: `c${c}-${k}`, x: c < 3 ? cx : cx + (alea() - 0.5) * 30, y: c < 3 ? cy : cy + (alea() - 0.5) * 30 });
  }
  for (let k = 0; k < 70; k++) items.push({ id: `d${k}`, x: alea() * 420, y: 140 + alea() * 600 });
  expect(items.length).toBe(150);
  const interdits = [{ x0: 0, y0: 0, x1: 420, y1: 130 }, { x0: 0, y0: 700, x1: 420, y1: 800 }];
  const t0 = Date.now();
  const res = placerEpingles({ items, interdits, ecran: ECRAN });
  const duree = Date.now() - t0;
  expect(duree).toBeLessThan(250);
  expect(res.size).toBe(150);
  const pts = finales(items, res);
  expect(aucunChevauchement(pts, chevauche, boite)).toBe(true);
  // déterminisme : même résultat quel que soit l'ordre d'entrée
  const melange = [...items].reverse();
  const res2 = placerEpingles({ items: melange, interdits, ecran: ECRAN });
  for (const i of items) expect(res2.get(i.id)).toEqual(res.get(i.id));
  // les boutiques isolées n'ont ni trait ni point
  expect([...res.values()].filter((r) => !r.ecarte).every((r) => r.dx === 0 && r.dy === 0)).toBe(true);
});

test("plafond de boutiques affichées : choisie d'abord, puis en stock, puis nombre d'articles, puis proximité du centre ; tout s'affiche sous le plafond", async () => {
  const { selectionnerVisibles, PLAFOND_DEFAUT } = await lib();
  expect(PLAFOND_DEFAUT).toBe(150);
  const ecran = { x0: 0, y0: 0, x1: 420, y1: 800 };
  const douze = Array.from({ length: 12 }, (_, k) => ({ id: `b${k}`, x: 30 + k * 30, y: 300, enStock: k % 2 === 0, nbArticles: k }));
  let r = selectionnerVisibles(douze, { plafond: 150, ecran });
  expect(r.retenues.size).toBe(12); // une douzaine : tout s'affiche
  expect(r.masquees).toBe(0);
  // 200 boutiques, plafond 150
  const deux = Array.from({ length: 200 }, (_, k) => ({ id: `b${String(k).padStart(3, "0")}`, x: 10 + (k % 40) * 10, y: 100 + Math.floor(k / 40) * 100, enStock: k >= 120, nbArticles: k % 7 }));
  r = selectionnerVisibles(deux, { plafond: 150, ecran });
  expect(r.retenues.size).toBe(150);
  expect(r.dansLaVue).toBe(200);
  expect(r.masquees).toBe(50);
  // toutes les boutiques en stock (80) sont retenues avant celles sans stock
  expect(deux.filter((b) => b.enStock).every((b) => r.retenues.has(b.id))).toBe(true);
  // la boutique choisie est toujours retenue, même sans stock et loin du centre
  const choisie = deux.find((b) => !b.enStock && b.nbArticles === 0);
  r = selectionnerVisibles(deux, { plafond: 150, ecran, idChoisi: choisie.id });
  expect(r.retenues.has(choisie.id)).toBe(true);
  expect(r.retenues.size).toBe(150);
  // plafond réglable
  expect(selectionnerVisibles(deux, { plafond: 20, ecran }).retenues.size).toBe(20);
  // boutiques hors de la vue (au-delà de la marge) : ni comptées ni affichées
  const hors = [{ id: "loin", x: 5000, y: 300 }, { id: "ici", x: 100, y: 300 }];
  r = selectionnerVisibles(hors, { plafond: 150, ecran });
  expect([...r.retenues]).toEqual(["ici"]);
  expect(r.dansLaVue).toBe(1);
});
