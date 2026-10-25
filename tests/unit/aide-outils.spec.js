const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Bouton « Aide » de chaque outil de « Fonctionnalités » : il ouvre l'écran vidéo d'aide existant, adapté à l'outil (une vidéo par outil viendra plus tard).
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");

test.describe("bouton Aide : DANS la page de chaque outil", () => {
  const lire2 = lire;
  test("plus de bouton « Aide » sur les lignes de la liste des outils", () => {
    const ligne = lire2("mobile/src/components/LigneOutil.tsx");
    expect(ligne).not.toMatch(/Aide|aide-video|help-circle/);
  });
  test("le composant : cible de 44 px, ouvre l'écran vidéo d'aide avec l'outil et son titre", () => {
    const b = lire2("mobile/src/components/BoutonAideOutil.tsx");
    expect(b).toContain("/aide-video?outil=${encodeURIComponent(outilId)}&titre=${encodeURIComponent(titre)}");
    expect(b).toContain("minHeight: 44");
    expect(b).toContain("accessibilityLabel={`Aide pour ${titre}`}");
  });
  test("pages du site ouvertes dans l'application : le bouton est dans l'en-tête de la page, pour l'outil transmis par `aide`", () => {
    const w = lire2("mobile/src/app/web/[cle].tsx");
    expect(w).toContain("const aideOutil = typeof aide === 'string' ? OUTILS.find((o) => o.id === aide) : undefined;");
    expect(w).toContain("{aideOutil ? <BoutonAideOutil outilId={aideOutil.id} titre={aideOutil.titre} /> : null}");
  });
  test("extracteur : le bouton est dans sa page", () => {
    expect(lire2("mobile/src/app/(tabs)/extracteur.tsx")).toContain('<BoutonAideOutil outilId="extracteur_ia" titre="Extracteur 1-Click" />');
  });
  test("chaque outil de la liste transmet son identifiant d'aide à sa page (sauf l'extracteur, dont la page porte déjà le bouton)", async () => {
    const { OUTILS } = await import("../../mobile/src/lib/outils.ts");
    const cible = (id) => { const a = []; OUTILS.find((o) => o.id === id).ouvrir({ push: (c) => a.push(c) }); return a[0]; };
    for (const id of ["compresser", "fusionner", "diviser", "organiser", "jpg_en_pdf", "pdf_en_jpg", "boite_idees", "diagnostic_cv", "services_modeles"]) {
      expect(cible(id), id).toContain(`aide=${id}`);
    }
    expect(cible("extracteur_ia")).toBe("/extracteur");
  });
  test("l'écran d'aide : titre et phrases propres à l'outil, pas la vidéo « pour postuler » ; WhatsApp garde l'interrupteur de l'admin", () => {
    const s = lire2("mobile/src/app/aide-video.tsx");
    expect(s).toContain("const pourUnOutil = typeof outil === 'string' && outil.length > 0;");
    expect(s).toContain("Comment utiliser « ${titre ?? 'cet outil'} »");
    expect(s).toContain("pourUnOutil ? aideVideoOutil(String(outil), v) : v");
    expect(lire2("mobile/src/lib/aideVideo.ts")).toContain("return { type: 'aucune', whatsappVisible: generale.whatsappVisible };");
  });
  test("l'aide des offres (« Aide » des publications) n'est pas modifiée", () => {
    expect(lire2("mobile/src/components/CarteOffre.tsx")).toContain("/aide-video?titre=${encodeURIComponent(offre.titre)}");
    expect(lire2("mobile/src/app/aide-video.tsx")).toContain("Vidéo d'explication pour postuler");
  });
});
