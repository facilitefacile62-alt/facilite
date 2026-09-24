const { test, expect } = require("@playwright/test");
const { ratioAffichage, RATIO_MIN, RATIO_MAX } = require("../../src/lib/formatImage.js");
const {
  FORMATS_AFFICHE,
  FORMAT_AFFICHE_PAR_DEFAUT,
  trouverFormatAffiche,
  idFormatPourFichier,
} = require("../../src/lib/formatsAffiche.js");

/**
 * Affichage adaptatif des images publiées : chaque image garde SON format,
 * sans bandes ni recadrage manuel. Seuls les formats extrêmes sont bornés.
 */

test.describe("ratioAffichage", () => {
  test("formats courants : rapport exact, jamais recadré", () => {
    expect(ratioAffichage(1000, 1000)).toBe(1);
    expect(ratioAffichage(1200, 800)).toBeCloseTo(1.5, 5);
    expect(ratioAffichage(832, 1248)).toBeCloseTo(2 / 3, 5);
    expect(ratioAffichage(1536, 864)).toBeCloseTo(16 / 9, 5);
    expect(ratioAffichage(1080, 1920)).toBeCloseTo(9 / 16, 5);
  });

  test("format très haut : borné à la limite haute, pas plus", () => {
    expect(ratioAffichage(300, 3000)).toBe(RATIO_MIN);
    expect(RATIO_MIN).toBe(0.5);
  });

  test("format très large : borné à la limite large, pas plus", () => {
    expect(ratioAffichage(4000, 500)).toBe(RATIO_MAX);
    expect(RATIO_MAX).toBe(2.4);
  });

  test("dimensions inconnues ou invalides : null (zone d'attente)", () => {
    expect(ratioAffichage(0, 100)).toBeNull();
    expect(ratioAffichage(100, 0)).toBeNull();
    expect(ratioAffichage(undefined, undefined)).toBeNull();
    expect(ratioAffichage(NaN, 10)).toBeNull();
    expect(ratioAffichage(-5, 10)).toBeNull();
    expect(ratioAffichage("abc", 10)).toBeNull();
  });
});

test.describe("formats d'affiche IA", () => {
  test("le format carré reste le défaut", () => {
    expect(FORMAT_AFFICHE_PAR_DEFAUT).toBe("1:1");
    expect(trouverFormatAffiche(undefined).id).toBe("1:1");
    expect(trouverFormatAffiche("n'importe quoi").id).toBe("1:1");
    expect(trouverFormatAffiche("1:1").largeur).toBe(1024);
  });

  test("chaque format a des dimensions multiples de 32 et le bon rapport", () => {
    for (const f of FORMATS_AFFICHE) {
      expect(f.largeur % 32, `${f.id} largeur`).toBe(0);
      expect(f.hauteur % 32, `${f.id} hauteur`).toBe(0);
      const [a, b] = f.id.split(":").map(Number);
      // Rapport EXACT : un 16:9 qui serait en fait 1,75 donnerait une image recadrée à l'affichage.
      expect(Math.abs(f.largeur / f.hauteur - a / b), f.id).toBeLessThan(0.0001);
    }
  });

  test("aucun format ne dépasse ~1,5 mégapixel (coût du moteur de rendu)", () => {
    for (const f of FORMATS_AFFICHE) {
      expect(f.largeur * f.hauteur, f.id).toBeLessThanOrEqual(1_500_000);
    }
  });

  test("identifiants uniques et utilisables dans un nom de fichier", () => {
    const ids = FORMATS_AFFICHE.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(idFormatPourFichier(trouverFormatAffiche("2:3"))).toBe("2x3");
    expect(idFormatPourFichier(trouverFormatAffiche("16:9"))).toBe("16x9");
  });

  test("dimensions demandées par le client ignorées : seul l'identifiant compte", () => {
    // La route ne lit que `format` ; un identifiant inconnu retombe sur 1:1.
    expect(trouverFormatAffiche("9999x9999").largeur).toBe(1024);
    expect(trouverFormatAffiche("2:3").hauteur).toBe(1248);
  });
});
