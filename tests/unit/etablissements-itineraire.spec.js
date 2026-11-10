const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Page « Établissements ouverts près de moi » : chaque établissement propose « Itinéraire » et « Démarrer » (Google Maps, par les coordonnées),
 * en plus du bouton « Appeler » qui existait déjà.
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");
const lib = () => import("../../src/lib/itineraire.js");

test("coordonnées : valides seulement (latitude -90..90, longitude -180..180) ; texte, vide et hors bornes refusés", async () => {
  const { coordonnees } = await lib();
  expect(coordonnees(14.7167, -17.4677)).toBe("14.7167,-17.4677");
  expect(coordonnees("14.75", "-17.39")).toBe("14.75,-17.39");
  expect(coordonnees(0, 0)).toBe("0,0");
  for (const [a, b] of [[null, 1], [1, null], ["", ""], ["abc", 1], [91, 0], [0, 181], [undefined, undefined], [NaN, 1]]) {
    expect(coordonnees(a, b), `${a},${b}`).toBeNull();
  }
});

test("« Itinéraire » : lien Google Maps vers les coordonnées de l'établissement, en voiture, avec le départ si on le connaît", async () => {
  const { lienItineraire } = await lib();
  const e = { latitude: 14.7547, longitude: -17.3906 };
  expect(lienItineraire(e)).toBe("https://www.google.com/maps/dir/?api=1&destination=14.7547,-17.3906&travelmode=driving");
  expect(lienItineraire(e, { latitude: 14.69, longitude: -17.44 })).toBe(
    "https://www.google.com/maps/dir/?api=1&origin=14.69,-17.44&destination=14.7547,-17.3906&travelmode=driving"
  );
  // Départ invalide : ignoré (Google Maps prend alors la position actuelle).
  expect(lienItineraire(e, { latitude: "x", longitude: 1 })).toBe("https://www.google.com/maps/dir/?api=1&destination=14.7547,-17.3906&travelmode=driving");
  expect(lienItineraire(e, null)).toBe("https://www.google.com/maps/dir/?api=1&destination=14.7547,-17.3906&travelmode=driving");
});

test("« Démarrer » : même trajet avec le guidage lancé (dir_action=navigate)", async () => {
  const { lienDemarrer, lienItineraire } = await lib();
  const e = { latitude: 14.7547, longitude: -17.3906 };
  expect(lienDemarrer(e)).toBe(`${lienItineraire(e)}&dir_action=navigate`);
  expect(lienDemarrer(e, { latitude: 14.69, longitude: -17.44 })).toContain("origin=14.69,-17.44");
  expect(lienDemarrer(e, { latitude: 14.69, longitude: -17.44 })).toMatch(/&dir_action=navigate$/);
});

test("établissement sans coordonnées : aucun lien (pas de bouton), jamais « undefined » ni « null » dans l'adresse", async () => {
  const { lienItineraire, lienDemarrer } = await lib();
  for (const e of [{}, { latitude: null, longitude: null }, { latitude: 14.7 }, null, undefined]) {
    expect(lienItineraire(e)).toBeNull();
    expect(lienDemarrer(e)).toBeNull();
  }
  const url = lienItineraire({ latitude: 14.7, longitude: -17.4 });
  expect(url).not.toMatch(/undefined|null|NaN/);
});

test("la page affiche Itinéraire et Démarrer pour chaque établissement (liens externes sûrs), sans retirer « Appeler »", () => {
  const p = lire("src/app/etablissements/page.js");
  expect(p).toContain('import { lienDemarrer, lienItineraire } from "@/lib/itineraire";');
  expect(p).toContain("lienItineraire(e, position) && (");
  expect(p).toContain("href={lienItineraire(e, position)}");
  expect(p).toContain("href={lienDemarrer(e, position)}");
  expect(p).toContain('data-testid="lien-itineraire"');
  expect(p).toContain('data-testid="lien-demarrer"');
  expect((p.match(/target="_blank"\s+rel="noopener noreferrer"/g) || []).length).toBeGreaterThanOrEqual(2);
  expect(p).toContain("href={`tel:${e.telephone}`}"); // « Appeler » reste
  // Aucun appel réseau ni enregistrement ajouté pour l'itinéraire.
  expect(fs.readFileSync(path.join(__dirname, "../../src/lib/itineraire.js"), "utf8")).not.toMatch(/fetch\(|supabase|localStorage/);
});

test("la carte des boutiques : Itinéraire et Démarrer restent sur la carte du site (trajet tracé, carte cadrée), sans ouvrir Google Maps", () => {
  const g = lire("src/components/GlobeExplorateurBoutiques.jsx");
  expect(g).toContain('["data-itineraire", "data-demarrer"]');
  expect(g).toContain("cadrer: true");
  expect(g).toContain("itineraireCibleProp || itineraireCible.cadrer");
  const i = g.indexOf('data-itineraire="${');
  const bulle = g.slice(i, i + 1200);
  expect(bulle).toContain("data-demarrer=");
  expect(bulle).not.toContain("google.com/maps");
  expect(g).not.toContain("lienDemarrer");
});

test("application mobile : « Démarrer » à côté d'« Itinéraire » dans le carrousel de la carte, trajet tracé dans l'application (jamais Google Maps)", () => {
  const c = lire("mobile/src/components/CarteLeaflet.tsx");
  expect(c).toContain('data-act="demarrer:');
  expect(c).toContain('data-act="itineraire:');
  const a = lire("mobile/src/app/marketplace/autour.tsx");
  expect(a).toContain("id.startsWith('itineraire:') || id.startsWith('demarrer:')");
  expect(a).toContain("calculerItineraire(position, arrivee)");
  expect(a).toContain("carte?.centrer(position.latitude, position.longitude, 17)");
  expect(a).not.toMatch(/google\.com\/maps|Linking\.openURL/);
});

test("application : la croix de la bulle ramène la carte à la vue d'avant le zoom (dézoom)", () => {
  const c = lire("mobile/src/components/CarteLeaflet.tsx");
  expect(c).toContain("window.memoriserVue = function");
  expect(c).toContain("window.restaurerVue = function");
  expect(c).toContain("if (!vueAvant) vueAvant =");
  const a = lire("mobile/src/app/marketplace/autour.tsx");
  expect(a).toMatch(/carte\?\.memoriserVue\(\);\n\s+setSelection\(id\);/);
  expect(a).toMatch(/if \(id === 'fermer'\) \{\n\s+setSelection\(null\);\n\s+carte\?\.restaurerVue\(\)/);
});
