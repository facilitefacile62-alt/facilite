const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/** Garde-fous de régression (constatés avant la campagne publicitaire) : lus dans le source. */
const lire = (p) => fs.readFileSync(path.resolve(__dirname, "../..", p), "utf-8");

test("la politique de sécurité autorise le pixel Microsoft Clarity (c.bing.com) : plus d'erreur de console", () => {
  const config = lire("next.config.mjs");
  const imgSrc = config.split("\n").find((l) => l.trim().startsWith('"img-src'));
  expect(imgSrc).toContain("https://c.bing.com");
  expect(imgSrc).toContain("https://*.clarity.ms");
});

test("les fonctions IA restent fermées tant que l'interrupteur n'a pas été lu côté serveur (plus de scan refusé en 403)", () => {
  const hook = lire("src/lib/useIaAutorisee.js");
  expect(hook).toMatch(/useState\(null\)/);
  expect(hook).toMatch(/arbre !== null && isFeatureAllowed/);
  expect(hook).not.toMatch(/useState\(DEFAULT_FEATURE_TREE\)/);
});

test("quand l'IA est en pause, une explication visible (pas seulement une infobulle) est affichée sous les boutons", () => {
  const client = lire("src/app/marketplace/MarketplaceClient.jsx");
  expect(client).toMatch(/!iaAutorisee && \(\s*<p[^>]*role="status"/);
});
