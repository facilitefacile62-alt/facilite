const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Touche « Carrousel » sur la carte produit du Marketplace : ouvre en plein écran toutes les photos de l'article, à faire défiler. La touche n'existe que sur la carte
 * (pas dans la fiche de l'article), ne déclenche pas l'ouverture de la fiche, et ne réécrit rien en base.
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");
const logique = () => import("../../src/lib/carrousselLogique.js");

test("index : borné, boucle de la dernière à la première photo et inversement, vide sans effet", async () => {
  const { bornerIndex, indexSuivant, indexPrecedent } = await logique();
  expect(bornerIndex(-3, 4)).toBe(0);
  expect(bornerIndex(9, 4)).toBe(3);
  expect(bornerIndex(2.4, 4)).toBe(2);
  expect(bornerIndex(1, 0)).toBe(0);
  expect(indexSuivant(0, 3)).toBe(1);
  expect(indexSuivant(2, 3)).toBe(0);
  expect(indexPrecedent(0, 3)).toBe(2);
  expect(indexPrecedent(2, 3)).toBe(1);
  expect(indexSuivant(0, 1)).toBe(0);
  expect(indexPrecedent(0, 1)).toBe(0);
  expect(indexSuivant(0, 0)).toBe(0);
});

test("défilement : la photo affichée vient de la position horizontale (chaque photo occupe toute la largeur)", async () => {
  const { indexDepuisDefilement } = await logique();
  expect(indexDepuisDefilement(0, 400, 5)).toBe(0);
  expect(indexDepuisDefilement(390, 400, 5)).toBe(1);
  expect(indexDepuisDefilement(820, 400, 5)).toBe(2);
  expect(indexDepuisDefilement(99999, 400, 5)).toBe(4);
  expect(indexDepuisDefilement(500, 0, 5)).toBe(0);
});

test("photos du carrousel : chaînes non vides, sans doublon, dans l'ordre ; le reste est ignoré", async () => {
  const { photosDuCarrousel } = await logique();
  expect(photosDuCarrousel(["a.jpg", " a.jpg ", "b.jpg", "", null, 7, "c.jpg", "b.jpg"])).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
  expect(photosDuCarrousel(null)).toEqual([]);
  expect(photosDuCarrousel("a.jpg")).toEqual([]);
});

test("carte produit : touche « Carrousel » sur la carte seulement, clic isolé de l'ouverture de la fiche, carrousel ouvert au toucher", () => {
  const c = lire("src/app/marketplace/MarketplaceClient.jsx");
  const carte = c.slice(c.indexOf("function CarteArticle("), c.indexOf("function DialogueSignalement("));
  expect(carte).toContain("Carrousel\n          </button>");
  expect(carte).toContain("setCarrousselOuvert(true);");
  // Le clic sur la touche ne doit pas ouvrir la fiche (onClick de la carte).
  expect(carte).toMatch(/onClick=\{\(e\) => \{\s*e\.stopPropagation\(\);\s*setCarrousselOuvert\(true\);/);
  expect(carte).toContain("{carrousselOuvert && <CarrousselPhotos photos={photosCarrousel}");
  // La touche n'existe nulle part ailleurs : ni dans la fiche de l'article, ni dans les autres composants.
  expect((c.match(/>\s*Carrousel\s*</g) || []).length).toBe(1);
  expect(c.split("<CarrousselPhotos").length - 1).toBe(1);
});

test("composant : plein écran dans un portail, clics isolés de la carte, Échap et flèches, croix, points, verrouillage du défilement de la page, Worker à l'affichage", () => {
  const k = lire("src/components/CarrousselPhotos.jsx");
  expect(k).toContain("createPortal(");
  expect(k).toContain('role="dialog"');
  expect(k).toContain('aria-modal="true"');
  expect(k).toContain("e.stopPropagation();");
  expect(k).toContain('e.key === "Escape"');
  expect(k).toContain('e.key === "ArrowRight"');
  expect(k).toContain('e.key === "ArrowLeft"');
  expect(k).toContain('aria-label="Fermer le carrousel"');
  expect(k).toContain("snap-x snap-mandatory");
  expect(k).toContain('document.body.style.overflow = "hidden"');
  expect(k).toContain("src={adresseImage(src)}");
  // Affichage seulement : aucune écriture en base.
  expect(k).not.toMatch(/supabase|\.update\(|\.insert\(/);
});
