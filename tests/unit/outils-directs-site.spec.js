const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Pont de session de l'application et page /fonctionnalites : un outil PDF demandé par l'application s'ouvre directement ; l'identifiant vient d'une
 * liste fermée ; dans la WebView, la liste des outils du site n'est pas proposée.
 */
const charger = () => import("../../src/lib/outilsDirects.js");
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");

test.describe("outils PDF ouverts directement depuis l'application", () => {
  test("liste fermée : les 6 outils PDF, rien d'autre ; l'adresse ne reprend jamais une valeur libre", async () => {
    const { OUTILS_PDF_DIRECTS, outilDirectValide, cheminFonctionnalites } = await charger();
    expect(OUTILS_PDF_DIRECTS).toEqual(["compresser-pdf", "fusionner-pdf", "diviser-pdf", "organiser-pdf", "jpg-en-pdf", "pdf-en-jpg"]);
    expect(cheminFonctionnalites("compresser-pdf")).toBe("/fonctionnalites?tool=compresser-pdf");
    expect(cheminFonctionnalites("pdf-en-jpg")).toBe("/fonctionnalites?tool=pdf-en-jpg");
    for (const mauvais of ["", null, undefined, "../admin", "compresser-pdf&x=1", "extracteur", "<script>", "COMPRESSER-PDF", 5]) {
      expect(outilDirectValide(mauvais)).toBe(false);
      expect(cheminFonctionnalites(mauvais)).toBe("/fonctionnalites");
    }
  });

  test("tous ces identifiants existent dans la page des outils (sinon rien ne s'ouvrirait)", async () => {
    const { OUTILS_PDF_DIRECTS } = await charger();
    const page = lire("src/app/fonctionnalites/FonctionnalitesClient.jsx");
    for (const id of OUTILS_PDF_DIRECTS) expect(page).toContain(`id: "${id}"`);
    expect(page).toContain('params.get("tool")');
  });

  test("le pont de session transmet l'outil seulement pour la cible « fonctionnalites » et par la liste fermée", () => {
    const s = lire("src/app/auth/mobile-bridge/route.js");
    expect(s).toContain('const outil = form.get("outil");');
    expect(s).toContain('cible === "fonctionnalites"');
    expect(s).toContain("cheminFonctionnalites(outil)");
    expect(s).toContain('import { cheminFonctionnalites } from "@/lib/outilsDirects";');
    // le chemin des autres cibles est inchangé
    expect(s).toContain("ALLOWED_MOBILE_BRIDGE_TARGETS[cible]");
    expect(s).toContain("redirect(new URL(cheminFinal, req.url), 303)");
  });

  test("dans la WebView de l'application, « Retour aux outils » n'est plus proposé quand un outil est ouvert directement", () => {
    const s = lire("src/app/fonctionnalites/FonctionnalitesClient.jsx");
    expect(s).toContain('document.cookie.includes("app_embed=1") && new URLSearchParams(window.location.search).has("tool")');
    expect(s).toMatch(/\{!ouvertDepuisApp && \(\s*<button[\s\S]{0,900}Retour aux outils/);
    expect(s).toContain("useSyncExternalStore");
  });
});
