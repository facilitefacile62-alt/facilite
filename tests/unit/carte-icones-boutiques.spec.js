const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Carte des boutiques : l'icône de chaque boutique (avatar, logo ou photo) doit se lire au premier coup d'œil dans la tête de son épingle (44 px, 52 px sélectionnée) ;
 * une boutique sans logo, sans avatar ni photo reçoit la première photo de ses articles.
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");
const mod = () => import("../../src/lib/epingleCarte.js");

test("épingle agrandie : 44 × 56 px (52 × 66 sélectionnée), pointe sur la coordonnée, tête plus grande", async () => {
  const { EPINGLE, htmlEpingle } = await mod();
  expect(EPINGLE.normal).toEqual({ l: 44, h: 56 });
  expect(EPINGLE.selectionne).toEqual({ l: 52, h: 66 });
  expect(EPINGLE.ancre).toEqual([70, 85]); // la pointe reste exactement sur la boutique : l'ancre de l'icône Leaflet n'a pas bougé
  const html = htmlEpingle({ couleur: "#10B981", nom: "Boutique", contenuHtml: '<img src="https://exemple/x.jpg" alt="" />' });
  expect(html).toContain("width:44px;height:56px");
  expect(html).toMatch(/width:34px;height:34px;border-radius:9999px;background:#fff/); // tête de 34 px (20 px avant) avec l'image de la boutique
  expect(html).toContain('<img src="https://exemple/x.jpg"');
  // Ordre d'empilement explicite : la goutte colorée (z-index 0) sous la tête qui porte l'icône (z-index 1). Sans cela, la règle de la carte donnait 200 à la goutte,
  // qui recouvrait les photos (les épingles à photo ressemblaient à des gouttes pleines).
  expect(html).toMatch(/<svg [^>]*z-index:0;/);
  expect(html).toMatch(/overflow:hidden;z-index:1;">/);
  // Épingle haute de 56 px, pointe à 85 px du haut de la boîte de 90 px : elle tient entièrement dans la boîte (et 66 px sélectionnée aussi).
  expect(EPINGLE.ancre[1] - EPINGLE.selectionne.h).toBeGreaterThanOrEqual(0);
});

test("sans image : pictogramme blanc dans une tête de la couleur de l'épingle (comportement conservé)", async () => {
  const { htmlEpingle } = await mod();
  const html = htmlEpingle({ couleur: "#2563EB", type: "service", nom: "Atelier", contenuHtml: '<span class="text-2xl">🔧</span>' });
  expect(html).toContain("background:#2563EB");
  expect(html).toContain("<svg");
});

test("carte : une boutique sans logo, avatar ni photo prend la première photo de ses articles ; l'ordre de priorité d'avant est conservé", () => {
  const g = lire("src/components/GlobeExplorateurBoutiques.jsx");
  expect(g).toContain("const articlesDeLaBoutique = (b) => {");
  expect(g).toContain("const photoPremierArticle = cheminPremierArticle ? urlPhoto(cheminPremierArticle) : null;");
  const iAvatar = g.indexOf("avatarOuArticle ||");
  const iPhoto = g.indexOf("(aPhoto", iAvatar);
  const iArticle = g.indexOf(": photoPremierArticle", iPhoto);
  const iEmoji = g.indexOf("avatarInfo.emoji", iArticle);
  expect(iAvatar).toBeGreaterThan(0);
  expect(iPhoto).toBeGreaterThan(iAvatar);
  expect(iArticle).toBeGreaterThan(iPhoto);
  expect(iEmoji).toBeGreaterThan(iArticle);
  // L'adresse injectée dans le HTML de l'icône est échappée (protection contre l'injection, voir echapperHtml).
  expect(g).toContain('`<img src="${echapperHtml(photoPremierArticle)}"');
});
