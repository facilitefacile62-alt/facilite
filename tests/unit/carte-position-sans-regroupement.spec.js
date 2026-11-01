const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * « Vous êtes ici » : petit point bleu (22 px) identique à celui de l'application, posé SOUS les épingles des boutiques, qui ne participe plus au regroupement :
 * il ne repousse plus les boutiques voisines en anneau autour de lui et ne cache plus personne. Même règle dans l'application (plus de grappe avec lui).
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

test("site : le marqueur de position est le point bleu de l'application (22 px, bordure blanche, halo), sans gros rond ni étiquette, ancre au centre", () => {
  const g = lire("src/components/GlobeExplorateurBoutiques.jsx");
  const bloc = g.slice(g.indexOf("const htmlMoi = `"), g.indexOf("const iconeMoi = L.divIcon({"));
  expect(bloc).toContain("width:22px;height:22px;border-radius:9999px;background:#4285F4;border:3px solid #fff");
  expect(bloc).toContain("box-shadow:0 0 0 7px rgba(66,133,244,.25)");
  expect(bloc).not.toMatch(/w-12|-inset-4|animate-ping|Vous êtes ici<|text-\[9px\]/);
  expect(g).toContain("iconSize: [28, 28],\n      iconAnchor: [14, 14],");
  expect(g).toContain('{ icon: iconeMoi, pane: "paneMoi", title: "Vous êtes ici" }');
  // Le même point que dans l'application : même couleur, même taille.
  const app = lire("mobile/src/components/CarteLeaflet.tsx");
  expect(app).toContain("width:22px;height:22px;border-radius:9999px;background:#4285F4;border:3px solid #fff");
});

test("site : le point de position passe SOUS les épingles (z-index 590 < 600) et n'entre plus dans le calcul de regroupement", () => {
  const g = lire("src/components/GlobeExplorateurBoutiques.jsx");
  expect(g).toContain('carte.getPane("paneMoi").style.zIndex = 590;');
  expect(g).not.toContain('style.zIndex = 640;');
  expect(g).not.toContain('points.push({ id: "__ici__"');
  expect(g).not.toMatch(/ici: true/);
});

test("application : « Vous êtes ici » ne forme plus de grappe avec les boutiques voisines", () => {
  const app = lire("mobile/src/components/CarteLeaflet.tsx");
  expect(app).not.toContain("avecMoi = true");
  expect(app).toContain("avecMoi reste faux");
  expect(app).toContain("var avecMoi = false;");
});
