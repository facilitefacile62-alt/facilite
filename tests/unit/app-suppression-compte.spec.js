const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * « Supprimer mon compte » dans l'application (exigé par Google Play) : entrée visible dans Paramètres (Facilité) et dans Sécurité & Connexion
 * (Facilité ET Locaux, l'écran est partagé), qui ouvre la page ffacilite.com/suppression-compte. La page publique existe et dit où trouver l'entrée.
 */
const racine = path.join(__dirname, "../..");
const lire = (p) => fs.readFileSync(path.join(racine, p), "utf8").replace(/\r\n/g, "\n");

test.describe("Supprimer mon compte", () => {
  test("Paramètres de Facilité : carte rouge « Supprimer mon compte » vers l'écran web de suppression", () => {
    const c = lire("mobile/src/components/ContenuParametres.tsx");
    expect(c).toContain("t('Supprimer mon compte')");
    expect(c).toContain("router.push('/web/suppression-compte' as Href)");
    expect(c).toMatch(/trash-outline[\s\S]{0,260}rouge/);
  });
  test("Sécurité & Connexion (Facilité et Locaux) : même entrée en bas de page, texte en français", () => {
    const s = lire("mobile/src/app/mon-profil/securite.tsx");
    expect(s).toContain("Supprimer mon compte");
    expect(s).toContain("Demander la suppression de votre compte et de vos données");
    expect(s).toContain("router.push('/web/suppression-compte' as Href)");
    expect(lire("mobile/src/app/marketplace/securite.tsx")).toContain("from '../mon-profil/securite'");
  });
  test("l'écran web pointe vers la page publique ffacilite.com/suppression-compte", () => {
    const w = lire("mobile/src/lib/webEcrans.ts");
    expect(w).toContain("'suppression-compte': protege('Suppression du compte', '/suppression-compte')");
    expect(w).toContain("export const SITE_URL = 'https://ffacilite.com'");
  });
  test("la page publique existe, sans compte, et indique le chemin « Sécurité & Connexion » > « Supprimer mon compte »", () => {
    const p = lire("src/app/suppression-compte/page.js");
    expect(p).toContain("Cette page est accessible sans compte");
    expect(p).toContain("Sécurité & Connexion");
    expect(p).toContain("Supprimer mon compte");
  });
});
