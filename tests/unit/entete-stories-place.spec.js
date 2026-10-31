const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * En-tête de l'Accueil : sur un téléphone étroit, les petits ronds de stories ne doivent plus être cachés par la bascule Facilité | Locaux. On garde ce qui
 * tient (jusqu'à 3) et, quand même un rond ne tient pas avec « ffacilite », on retire le mot (le logo reste).
 */
const logique = () => import("../../mobile/src/lib/entetePlaceLogique.ts");
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

test("largeurs de téléphones courantes : au moins un rond visible, jamais plus de 3, mot retiré seulement si nécessaire", async () => {
  const { placeStories } = await logique();
  // 3 stories non vues disponibles.
  expect(placeStories(412, 3)).toEqual({ ronds: 3, sansMot: false });
  expect(placeStories(393, 3)).toEqual({ ronds: 2, sansMot: false });
  expect(placeStories(360, 3)).toEqual({ ronds: 3, sansMot: true });
  expect(placeStories(320, 3)).toEqual({ ronds: 3, sansMot: true });
  for (const l of [320, 340, 360, 375, 390, 393, 412, 430, 480, 600]) {
    const p = placeStories(l, 3);
    expect(p.ronds, `largeur ${l}`).toBeGreaterThanOrEqual(1);
    expect(p.ronds, `largeur ${l}`).toBeLessThanOrEqual(3);
  }
});

test("moins de stories que de places : on n'en invente pas ; aucune story : rien à placer, le mot reste", async () => {
  const { placeStories } = await logique();
  expect(placeStories(412, 1).ronds).toBe(1);
  expect(placeStories(412, 2).ronds).toBe(2);
  expect(placeStories(360, 0)).toEqual({ ronds: 0, sansMot: false });
});

test("l'en-tête utilise ce calcul : ronds limités à ce qui tient, mot retiré au besoin, groupe de droite non comprimé", () => {
  const h = lire("mobile/src/components/FaciliteHeader.tsx");
  expect(h).toContain("placeStories(largeurEcran, petitesStories.length)");
  expect(h).toContain("petitesStories.slice(0, rondsAffiches)");
  expect(h).toContain("{serre && sansMot ? null : <Text");
  expect(h).toContain("flexShrink: 0");
});

test("largeur mesurée après la mise en page : un conteneur de ronds trop étroit (police ou affichage agrandis) retire le mot, aucun bout de rond coincé contre la bascule", () => {
  const h = lire("mobile/src/components/FaciliteHeader.tsx");
  expect(h).toContain("onLayout={(e) => {");
  expect(h).toContain("if (l < ROND && !sansMotMesure) setSansMotMesure(true);");
  expect(h).toContain("rondsQuiTiennent(largeurRonds)");
  expect(h).toContain("maxFontSizeMultiplier={1}");
});
