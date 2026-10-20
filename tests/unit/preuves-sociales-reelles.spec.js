const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Aucune « preuve sociale » inventée sur la Marketplace (constaté avant la campagne publicitaire : « (23 avis) »,
 * « 4 K ami(e)s », « 120+ vendus », note 4.3 et badge « Vérifié » affichés pour une boutique et un article tout neufs).
 * Garde-fou de régression sur le source : ces valeurs ne doivent plus figurer en dur.
 */
const source = fs.readFileSync(path.resolve(__dirname, "../../src/app/marketplace/MarketplaceClient.jsx"), "utf-8");

test("aucun nombre d'avis, d'amis, de ventes ou note inventés en dur", () => {
  expect(source).not.toMatch(/: 23\} avis/);
  expect(source).not.toMatch(/amis_count \|\| "4 K"/);
  expect(source).not.toMatch(/120\+ vendus/);
  expect(source).not.toMatch(/font-bold text-gray-900 dark:text-gray-100">4\.3</);
});

test("le badge « Vérifié » de la fiche article dépend de boutique_verifie", () => {
  const i = source.indexOf("Carte Boutique / Vendeur Vérifié sous l'image");
  expect(i).toBeGreaterThan(0);
  const extrait = source.slice(i, i + 3500);
  expect(extrait).toMatch(/article\.boutique_verifie === true/);
});
