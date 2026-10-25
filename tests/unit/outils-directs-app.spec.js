const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * « Fonctionnalités » de l'application : toucher un outil PDF ouvre DIRECTEMENT cet outil (pas la liste des outils du site, avec son autre design).
 */
const outils = () => import("../../mobile/src/lib/outils.ts");
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");

// Liste fermée des identifiants que le site accepte (src/lib/outilsDirects.js, branche du site).
const IDS_SITE = ["compresser-pdf", "fusionner-pdf", "diviser-pdf", "organiser-pdf", "jpg-en-pdf", "pdf-en-jpg"];
const ATTENDU = {
  compresser: "compresser-pdf",
  fusionner: "fusionner-pdf",
  diviser: "diviser-pdf",
  organiser: "organiser-pdf",
  jpg_en_pdf: "jpg-en-pdf",
  pdf_en_jpg: "pdf-en-jpg",
};

test.describe("outils PDF : ouverture directe", () => {
  test("chaque outil PDF ouvre /web/fonctionnalites avec SON identifiant, pris dans la liste fermée du site", async () => {
    const { OUTILS } = await outils();
    for (const [id, outilSite] of Object.entries(ATTENDU)) {
      const outil = OUTILS.find((o) => o.id === id);
      expect(outil, id).toBeTruthy();
      const appels = [];
      outil.ouvrir({ push: (c) => appels.push(c) });
      expect(appels).toEqual([`/web/fonctionnalites?outil=${outilSite}&aide=${id}`]);
      expect(IDS_SITE).toContain(outilSite);
    }
    expect(new Set(Object.values(ATTENDU)).size).toBe(6); // jamais deux outils vers la même page
  });

  test("les autres outils ne changent pas (extracteur, boîte à idées, diagnostic, studio)", async () => {
    const { OUTILS } = await outils();
    const cible = (id) => {
      const appels = [];
      OUTILS.find((o) => o.id === id).ouvrir({ push: (c) => appels.push(c) });
      return appels[0];
    };
    expect(cible("extracteur_ia")).toBe("/extracteur");
    expect(cible("boite_idees")).toBe("/web/boite-a-idees?aide=boite_idees");
    expect(cible("diagnostic_cv")).toBe("/web/importer-cv?aide=diagnostic_cv");
    expect(cible("services_modeles")).toBe("/web/modeles?aide=services_modeles");
    expect(OUTILS).toHaveLength(10);
  });

  test("la WebView ne transmet l'outil que pour la page des outils, et seulement s'il a la forme d'un identifiant", () => {
    const s = lire("mobile/src/app/web/[cle].tsx");
    expect(s).toContain("cle === 'fonctionnalites' && outil && /^[a-z-]{3,30}$/.test(outil)");
    expect(s).toContain("&outil=${encodeURIComponent(outil)}");
  });
});
