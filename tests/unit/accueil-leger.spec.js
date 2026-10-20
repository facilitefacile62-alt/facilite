const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Accueil mobile léger (avant la campagne publicitaire : 8,5 Mo, 30 affiches construites d'un coup, Lighthouse 35).
 * Garde-fous de régression lus dans le source et dans le dossier public/.
 */
const racine = path.resolve(__dirname, "../..");
const lire = (p) => fs.readFileSync(path.join(racine, p), "utf-8");

test("le fil de l'accueil n'affiche que 8 cartes au premier rendu et s'allonge de 8 en 8", () => {
  const home = lire("src/app/HomeClient.jsx");
  expect(home).toMatch(/const PAS_AFFICHAGE = 8;/);
  expect(home).toMatch(/useState\(PAS_AFFICHAGE\)/);
  expect(home).toMatch(/setDisplayLimit\(\(prev\) => prev \+ 8\)/);
  expect(home).not.toMatch(/useState\(30\)/);
});

test("seule la première affiche du fil est chargée tout de suite, les autres en chargement différé", () => {
  const home = lire("src/app/HomeClient.jsx");
  expect(home).toMatch(/loadingCouverture=\{indexJob === 0 \? "eager" : "lazy"\}/);
  const offres = lire("src/app/offres/OffresClient.jsx");
  expect(offres).toMatch(/loadingCouverture=\{idx === 0 \? "eager" : "lazy"\}/);
  // Une fiche d'offre ouverte seule garde le chargement immédiat (valeur par défaut).
  expect(lire("src/components/OfferMediaGallery.jsx")).toMatch(/loadingCouverture = "eager"/);
});

test("les images statiques du premier écran existent aussi en WebP, bien plus légères", () => {
  for (const [webp, jpg] of [["public/pyxis_logistics_chauffeur.webp", "public/pyxis_logistics_chauffeur.jpg"], ["public/affiche_cv_pro.webp", "public/affiche_cv_pro.jpg"]]) {
    const taille = fs.statSync(path.join(racine, webp)).size;
    expect(taille, webp).toBeLessThan(120 * 1024);
    expect(taille, webp).toBeLessThan(fs.statSync(path.join(racine, jpg)).size * 0.8);
  }
});
