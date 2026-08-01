"use client";

/**
 * Capture un nœud DOM (l'aperçu CV déjà rendu, #cv-preview-sheet — fixé à
 * 595x842px, soit exactement les dimensions A4 en points PDF) et le
 * transforme en PDF téléchargeable.
 *
 * Une seule page : le conteneur source est volontairement à hauteur fixe
 * avec overflow-hidden (voir creer-cv/page.js) — le contenu affiché à
 * l'écran EST déjà tout ce qui doit apparaître sur le CV, pas de pagination
 * à gérer côté export sans en ajouter une côté aperçu d'abord.
 *
 * Import dynamique de html2canvas-pro/jsPDF à l'appel plutôt qu'en haut de
 * fichier : ce sont de grosses libs purement client-side, inutiles dans le
 * bundle initial de /creer-cv (chargées seulement au moment du téléchargement).
 *
 * html2canvas-pro (fork maintenu de html2canvas), pas html2canvas : ce
 * projet est en Tailwind v4, dont la palette par défaut génère des
 * couleurs oklch()/lab() — le html2canvas d'origine ne sait pas les
 * parser et plante immédiatement ("unsupported color function"),
 * constaté empiriquement sur l'aperçu réel avant ce changement.
 */
export async function exportElementToPdf(element, filename) {
  if (!element) {
    throw new Error("Aperçu introuvable — impossible de générer le PDF.");
  }

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(element, {
    scale: 2, // qualité impression, pas juste résolution écran
    useCORS: true,
    backgroundColor: "#ffffff",
  });

  const imageData = canvas.toDataURL("image/jpeg", 0.95);

  // Format "a4" + unité "pt" : 595.28 x 841.89pt, quasi identique aux
  // 595x842px de #cv-preview-sheet — l'image remplit la page sans marge ni
  // déformation notable.
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  pdf.addImage(imageData, "JPEG", 0, 0, pageWidth, pageHeight);
  pdf.save(filename);
}
