const { test, expect } = require("@playwright/test");

// Épingles fixées à leur lieu : étape 1 (mètres, espace réel) et étape 2 (pixels, minimal, faible zoom). Calcul pur.

async function lib() {
  return import("../../src/lib/ecartementEpingles.js");
}

const LAT = 14.7557;
const LNG = -17.3843;
// mètres par pixel à un zoom MapLibre (tuiles de 512 px) et à la latitude de Dakar
const mParPx = (zoom) => (78271.517 * Math.cos((LAT * Math.PI) / 180)) / 2 ** zoom;
// position réelle -> pixels à un zoom donné, par rapport au point (LAT, LNG)
const enPixels = (b, zoom) => ({ x: ((b.lng - LNG) * 111320 * Math.cos((LAT * Math.PI) / 180)) / mParPx(zoom), y: (-(b.lat - LAT) * 111320) / mParPx(zoom) });

test("au même point : toutes les boutiques présentes, positions distinctes en mètres, aucune ne se chevauche au zoom 18", async () => {
  const { decalerEnMetres, epinglesSeChevauchent, ESPACEMENT_EST_M } = await lib();
  const noms = ["masque", "facile demo", "Moïse Couture", "Ndiaye électrique"];
  const res = decalerEnMetres(noms.map((id) => ({ id, lat: LAT, lng: LNG })));
  expect(res.size).toBe(4);
  const pos = noms.map((id) => ({ id, ...res.get(id) }));
  expect(pos.every((p) => p.decale)).toBe(true);
  expect(new Set(pos.map((p) => `${p.lat.toFixed(8)},${p.lng.toFixed(8)}`)).size).toBe(4); // positions distinctes
  // une seule rangée est-ouest de 15 m entre épingles, centrée sur le point commun
  expect(new Set(pos.map((p) => p.nordM)).size).toBe(1);
  const est = pos.map((p) => p.estM).sort((a, b) => a - b);
  expect(est[1] - est[0]).toBeCloseTo(ESPACEMENT_EST_M, 5);
  expect((est[0] + est[3]) / 2).toBeCloseTo(0, 5);
  expect(Math.max(...pos.map((p) => Math.hypot(p.estM, p.nordM)))).toBeLessThanOrEqual(25); // quelques mètres autour du point
  // zoom 18 : aucune épingle ne cache une autre
  const px = pos.map((p) => enPixels(p, 18));
  for (let a = 0; a < px.length; a++) for (let b = a + 1; b < px.length; b++) expect(epinglesSeChevauchent(px[a].x, px[a].y, px[b].x, px[b].y)).toBe(false);
});

test("deux amas voisins (20 m) : aucune épingle ne chevauche une autre au zoom 18, même entre amas ; une boutique isolée proche d'un amas n'est déplacée que si nécessaire", async () => {
  const { decalerEnMetres, epinglesSeChevauchent, metresVersDegres } = await lib();
  const a = metresVersDegres(LAT, 20, 0);
  const boutiques = [
    { id: "a1", lat: LAT, lng: LNG },
    { id: "a2", lat: LAT, lng: LNG },
    { id: "b1", lat: LAT + a.dLat, lng: LNG + a.dLng },
    { id: "b2", lat: LAT + a.dLat, lng: LNG + a.dLng },
    { id: "voisine", lat: LAT + metresVersDegres(LAT, 0, 22).dLat, lng: LNG },
    { id: "loin", lat: LAT + metresVersDegres(LAT, 0, 300).dLat, lng: LNG },
  ];
  const res = decalerEnMetres(boutiques);
  const px = boutiques.map((b) => ({ id: b.id, ...enPixels(res.get(b.id), 18) }));
  for (let i = 0; i < px.length; i++) for (let j = i + 1; j < px.length; j++) expect(epinglesSeChevauchent(px[i].x, px[i].y, px[j].x, px[j].y)).toBe(false);
  expect(res.get("loin").decale).toBe(false); // à 300 m : jamais touchée
  expect(res.size).toBe(6);
});

test("une boutique isolée n'est pas décalée ; les voisines à plus d'une épingle non plus", async () => {
  const { decalerEnMetres, metresVersDegres } = await lib();
  const loin = metresVersDegres(LAT, 40, 40);
  const res = decalerEnMetres([
    { id: "seule", lat: LAT, lng: LNG },
    { id: "voisine", lat: LAT + loin.dLat, lng: LNG + loin.dLng }, // à ~57 m : pas de chevauchement au zoom 18
    { id: "ailleurs", lat: 14.9, lng: -17.1 },
  ]);
  for (const id of ["seule", "voisine", "ailleurs"]) expect(res.get(id).decale).toBe(false);
  expect(res.get("seule")).toMatchObject({ lat: LAT, lng: LNG, estM: 0, nordM: 0 });
  expect(decalerEnMetres([{ id: "a", lat: LAT, lng: LNG }]).get("a").decale).toBe(false);
  expect(decalerEnMetres([]).size).toBe(0);
});

test("le décalage est stable : mêmes positions à chaque chargement, quel que soit l'ordre, et indépendant du zoom", async () => {
  const { decalerEnMetres } = await lib();
  const boutiques = [
    { id: "d", lat: LAT, lng: LNG },
    { id: "a", lat: LAT, lng: LNG },
    { id: "c", lat: LAT + 0.00002, lng: LNG },
    { id: "b", lat: LAT, lng: LNG },
    { id: "z", lat: 14.9, lng: -17.1 },
  ];
  const r1 = decalerEnMetres(boutiques);
  const r2 = decalerEnMetres([...boutiques].reverse());
  const r3 = decalerEnMetres(boutiques);
  for (const b of boutiques) {
    expect(r2.get(b.id)).toEqual(r1.get(b.id));
    expect(r3.get(b.id)).toEqual(r1.get(b.id));
  }
  // une boutique lointaine de plus (même avec un identifiant qui passe en tête) ne change pas la rangée
  const r4 = decalerEnMetres([{ id: "0-lointaine", lat: 14.5, lng: -17.0 }, ...boutiques]);
  for (const id of ["a", "b", "c", "d"]) expect(r4.get(id)).toEqual(r1.get(id));
  // aucune notion de zoom dans l'étape 1 : la fonction ne prend que des boutiques
  expect(decalerEnMetres.length).toBe(1);
  // 8 et 15 boutiques au même point : compact (quelques dizaines de mètres), positions toutes distinctes
  for (const nb of [8, 15]) {
    const m = Array.from({ length: nb }, (_, k) => ({ id: `s${String(k).padStart(2, "0")}`, lat: LAT, lng: LNG }));
    const r = decalerEnMetres(m);
    expect(new Set([...r.values()].map((p) => `${p.estM},${p.nordM}`)).size).toBe(nb);
    expect(Math.max(...[...r.values()].map((p) => Math.hypot(p.estM, p.nordM)))).toBeLessThanOrEqual(60);
  }
});

test("étape 2 (pixels) : décalage minimal à faible zoom, jamais vers le haut, jamais plus de 44 px, nul dès qu'il y a la place", async () => {
  const { ecarterEnPixels, DISTANCE_TETES_PX, DEPLACEMENT_MAX_PX } = await lib();
  // deux épingles à 10 px : repoussées du strict nécessaire
  let res = ecarterEnPixels({ items: [{ id: "a", x: 200, y: 400 }, { id: "b", x: 210, y: 400 }] });
  const a = res.get("a");
  const b = res.get("b");
  const d = Math.hypot(210 + b.dx - (200 + a.dx), 400 + b.dy - (400 + a.dy));
  expect(d).toBeGreaterThanOrEqual(DISTANCE_TETES_PX - 0.6);
  expect(d).toBeLessThanOrEqual(DISTANCE_TETES_PX + 2); // le plus petit possible
  for (const r of [a, b]) {
    expect(r.dy).toBeGreaterThanOrEqual(0); // jamais au-dessus du lieu
    expect(Math.hypot(r.dx, r.dy)).toBeLessThanOrEqual(DEPLACEMENT_MAX_PX + 0.01);
  }
  // assez de place : aucun décalage
  res = ecarterEnPixels({ items: [{ id: "a", x: 100, y: 400 }, { id: "b", x: 150, y: 400 }] });
  expect(res.get("a")).toEqual({ dx: 0, dy: 0, ecarte: false });
  expect(res.get("b")).toEqual({ dx: 0, dy: 0, ecarte: false });
  // le décalage diminue en zoomant (deux boutiques à 15 m l'une de l'autre) et disparaît dès le zoom 18
  const deplacement = (zoom) => {
    const gauche = { id: "a", x: 200 - 7.5 / mParPx(zoom), y: 400 };
    const droite = { id: "b", x: 200 + 7.5 / mParPx(zoom), y: 400 };
    const r = ecarterEnPixels({ items: [gauche, droite] });
    return Math.max(Math.hypot(r.get("a").dx, r.get("a").dy), Math.hypot(r.get("b").dx, r.get("b").dy));
  };
  const par = [14, 15, 16, 17, 18].map(deplacement);
  for (let k = 1; k < par.length; k++) expect(par[k]).toBeLessThanOrEqual(par[k - 1] + 0.01);
  expect(par[4]).toBe(0); // zoom 18 : 52 px entre les deux épingles, plus rien à écarter
  expect(par[3]).toBeGreaterThan(0); // zoom 17 : 26 px, petit décalage
  expect(par[3]).toBeLessThan(10);
  // amas dense à faible zoom : jamais plus de 44 px du lieu, déterministe
  const amas = Array.from({ length: 20 }, (_, k) => ({ id: `p${String(k).padStart(2, "0")}`, x: 210 + (k % 4), y: 400 + Math.floor(k / 4) }));
  const r1 = ecarterEnPixels({ items: amas });
  const r2 = ecarterEnPixels({ items: [...amas].reverse() });
  for (const i of amas) {
    const o = r1.get(i.id);
    expect(Math.hypot(o.dx, o.dy)).toBeLessThanOrEqual(DEPLACEMENT_MAX_PX + 0.01);
    expect(o.dy).toBeGreaterThanOrEqual(0);
    expect(r2.get(i.id)).toEqual(o);
  }
  // pas de décalage pour une épingle seule ni pour une liste vide
  expect(ecarterEnPixels({ items: [{ id: "a", x: 1, y: 1 }] }).get("a").ecarte).toBe(false);
  expect(ecarterEnPixels({ items: [] }).size).toBe(0);
});

test("étape 2 : une épingle déplacée n'entre pas dans une zone interdite (recherche, panneau, bande, boutons)", async () => {
  const { ecarterEnPixels, chevauche, PIN } = await lib();
  const interdits = [{ x0: 0, y0: 560, x1: 420, y1: 800 }]; // panneau + bande de boutiques
  const boite = (x, y) => ({ x0: x - PIN.l / 2, x1: x + PIN.l / 2, y0: y - PIN.h, y1: y });
  // deux épingles juste au-dessus de la zone : les repousser vers le bas les ferait entrer dans la zone
  const items = [{ id: "a", x: 200, y: 556 }, { id: "b", x: 208, y: 556 }];
  const res = ecarterEnPixels({ items, interdits });
  for (const i of items) {
    const r = res.get(i.id);
    expect(chevauche(boite(i.x + r.dx, i.y + r.dy), interdits[0])).toBe(chevauche(boite(i.x, i.y), interdits[0]));
  }
});

test("150 boutiques : étapes 1 et 2 rapides, déterministes, décalages bornés", async () => {
  const { decalerEnMetres, ecarterEnPixels, DEPLACEMENT_MAX_PX } = await lib();
  let graine = 12345;
  const alea = () => ((graine = (graine * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const boutiques = [];
  for (let c = 0; c < 10; c++) {
    const lat = 14.75 + c * 0.003;
    const lng = -17.4 + (c % 5) * 0.003;
    for (let k = 0; k < 8; k++) boutiques.push({ id: `c${c}-${k}`, lat: c < 3 ? lat : lat + (alea() - 0.5) * 0.0004, lng: c < 3 ? lng : lng + (alea() - 0.5) * 0.0004 });
  }
  for (let k = 0; k < 70; k++) boutiques.push({ id: `d${k}`, lat: 14.7 + alea() * 0.1, lng: -17.45 + alea() * 0.1 });
  expect(boutiques.length).toBe(150);
  const t0 = Date.now();
  const reel = decalerEnMetres(boutiques);
  const items = boutiques.map((b) => {
    const p = reel.get(b.id);
    return { id: b.id, x: ((p.lng - -17.4) * 111320 * 0.967) / mParPx(13), y: (-(p.lat - 14.75) * 111320) / mParPx(13) + 500 };
  });
  const px = ecarterEnPixels({ items });
  expect(Date.now() - t0).toBeLessThan(1500); // large marge : machine chargée (build en parallèle)
  expect(px.size).toBe(150);
  for (const v of px.values()) {
    expect(Math.hypot(v.dx, v.dy)).toBeLessThanOrEqual(DEPLACEMENT_MAX_PX + 0.01);
    expect(v.dy).toBeGreaterThanOrEqual(0);
  }
  const reel2 = decalerEnMetres([...boutiques].reverse());
  for (const b of boutiques) expect(reel2.get(b.id)).toEqual(reel.get(b.id));
});

test("plafond de boutiques affichées : choisie d'abord, puis en stock, puis nombre d'articles, puis proximité du centre ; tout s'affiche sous le plafond", async () => {
  const { selectionnerVisibles, PLAFOND_DEFAUT } = await lib();
  expect(PLAFOND_DEFAUT).toBe(150);
  const ecran = { x0: 0, y0: 0, x1: 420, y1: 800 };
  const douze = Array.from({ length: 12 }, (_, k) => ({ id: `b${k}`, x: 30 + k * 30, y: 300, enStock: k % 2 === 0, nbArticles: k }));
  let r = selectionnerVisibles(douze, { plafond: 150, ecran });
  expect(r.retenues.size).toBe(12); // une douzaine : tout s'affiche
  expect(r.masquees).toBe(0);
  const deux = Array.from({ length: 200 }, (_, k) => ({ id: `b${String(k).padStart(3, "0")}`, x: 10 + (k % 40) * 10, y: 100 + Math.floor(k / 40) * 100, enStock: k >= 120, nbArticles: k % 7 }));
  r = selectionnerVisibles(deux, { plafond: 150, ecran });
  expect(r.retenues.size).toBe(150);
  expect(r.dansLaVue).toBe(200);
  expect(r.masquees).toBe(50);
  expect(deux.filter((b) => b.enStock).every((b) => r.retenues.has(b.id))).toBe(true);
  const choisie = deux.find((b) => !b.enStock && b.nbArticles === 0);
  r = selectionnerVisibles(deux, { plafond: 150, ecran, idChoisi: choisie.id });
  expect(r.retenues.has(choisie.id)).toBe(true);
  expect(r.retenues.size).toBe(150);
  expect(selectionnerVisibles(deux, { plafond: 20, ecran }).retenues.size).toBe(20);
  const hors = [{ id: "loin", x: 5000, y: 300 }, { id: "ici", x: 100, y: 300 }];
  r = selectionnerVisibles(hors, { plafond: 150, ecran });
  expect([...r.retenues]).toEqual(["ici"]);
  expect(r.dansLaVue).toBe(1);
});
