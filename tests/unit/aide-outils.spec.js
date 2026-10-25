const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Bouton « Aide » de chaque outil de « Fonctionnalités » : il ouvre l'écran vidéo d'aide existant, adapté à l'outil (une vidéo par outil viendra plus tard).
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");

test.describe("bouton Aide des outils", () => {
  const ligne = lire("mobile/src/components/LigneOutil.tsx");
  test("la ligne d'outil porte un bouton « Aide » (cible de 44 px) qui ouvre l'écran vidéo avec l'outil", () => {
    expect(ligne).toContain("/aide-video?outil=${encodeURIComponent(outil.id)}&titre=${encodeURIComponent(outil.titre)}");
    expect(ligne).toContain("minHeight: 44");
    expect(ligne).toContain("{t('Aide')}");
    expect(ligne).toContain("accessibilityLabel={`Aide pour ${outil.titre}`}");
  });
  test("les deux écrans qui listent les outils utilisent cette ligne : le bouton est donc sur TOUS les outils", () => {
    expect(lire("mobile/src/app/(tabs)/profil.tsx")).toContain("<LigneOutil");
    expect(lire("mobile/src/app/fonctionnalites.tsx")).toContain("<LigneOutil");
  });
  test("l'écran d'aide : titre et phrases propres à l'outil, pas la vidéo « pour postuler » ; WhatsApp garde l'interrupteur de l'admin", () => {
    const s = lire("mobile/src/app/aide-video.tsx");
    expect(s).toContain("const pourUnOutil = typeof outil === 'string' && outil.length > 0;");
    expect(s).toContain("Comment utiliser « ${titre ?? 'cet outil'} »");
    expect(s).toContain("Regardez cette courte vidéo pour savoir comment utiliser cet outil.");
    expect(s).toContain("pourUnOutil ? aideVideoOutil(String(outil), v) : v");
    expect(s).toContain("pourUnOutil ? null : (");
    const lib = lire("mobile/src/lib/aideVideo.ts");
    expect(lib).toContain("export function aideVideoOutil(");
    expect(lib).toContain("return { type: 'aucune', whatsappVisible: generale.whatsappVisible };");
  });
  test("l'aide des offres (« Aide » des publications) n'est pas modifiée", () => {
    expect(lire("mobile/src/components/CarteOffre.tsx")).toContain("/aide-video?titre=${encodeURIComponent(offre.titre)}");
    expect(lire("mobile/src/app/aide-video.tsx")).toContain("Vidéo d'explication pour postuler");
  });
});
