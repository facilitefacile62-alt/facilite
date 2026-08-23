"use client";

// Moteur de compression PDF réel, 100% client-side (Canvas + PDF.js pour le
// rendu, pdf-lib pour le réassemblage) — extrait de FonctionnalitesClient.jsx
// pour être réutilisable ailleurs (ex. outil IA "compression de CV importé",
// src/lib/aiTools/compressImportedCv.js). Aucun équivalent serveur : la
// compression repose sur `document.createElement("canvas")`, impossible à
// exécuter dans une fonction Node — voir le diagnostic du 2026-08-22
// (aiTools) qui a confirmé l'absence de mécanisme de compression serveur
// dans ce dépôt malgré sharp/pdf-lib en dépendances.
import { PDFDocument } from "pdf-lib";

async function getPdfJsEngine() {
  if (typeof window === "undefined") return null;
  if (window.pdfjsLib) return window.pdfjsLib;

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/pdfjs/pdf.min.js";
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.js";
        resolve(window.pdfjsLib);
      } else {
        reject(new Error("Moteur PDF.js introuvable après chargement"));
      }
    };
    script.onerror = () => reject(new Error("Échec du chargement du moteur PDF.js"));
    document.body.appendChild(script);
  });
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}

/**
 * Compresse un fichier PDF en le re-rendant page par page en JPEG (qualité
 * réglable) puis en le réassemblant — même algorithme que l'outil public
 * "Compression PDF" de /fonctionnalites, factorisé ici.
 *
 * @param {File|Blob} file
 * @param {{ mode?: 'recommended'|'low', onProgress?: (percent:number)=>void }} options
 * @returns {Promise<{ blob: Blob, fileName: string, originalSizeBytes: number, newSizeBytes: number, savingsPercent: number }>}
 */
export async function compressPdfFile(file, { mode = "recommended", onProgress } = {}) {
  const report = (p) => onProgress?.(p);
  report(10);

  const arrayBuffer = await file.arrayBuffer();
  report(20);

  const pdfjs = await getPdfJsEngine();
  report(35);

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
  const srcPdf = await loadingTask.promise;
  const numPages = srcPdf.numPages;

  const compressedPdfDoc = await PDFDocument.create();

  // 'recommended': échelle 1.35, qualité 0.60 -> compresse fortement en
  // gardant un texte net. 'low': échelle 1.65, qualité 0.78 -> compression
  // modérée.
  const scale = mode === "recommended" ? 1.35 : 1.65;
  const jpegQuality = mode === "recommended" ? 0.6 : 0.78;

  for (let i = 1; i <= numPages; i++) {
    report(35 + Math.round((i / numPages) * 55));
    const page = await srcPdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    await page.render({ canvasContext: ctx, viewport }).promise;

    const dataUrl = canvas.toDataURL("image/jpeg", jpegQuality);
    const binaryString = atob(dataUrl.split(",")[1]);
    const bytes = new Uint8Array(binaryString.length);
    for (let j = 0; j < binaryString.length; j++) {
      bytes[j] = binaryString.charCodeAt(j);
    }

    const embeddedJpg = await compressedPdfDoc.embedJpg(bytes);
    const origWidth = page.view[2] - page.view[0];
    const origHeight = page.view[3] - page.view[1];

    const newPage = compressedPdfDoc.addPage([origWidth, origHeight]);
    newPage.drawImage(embeddedJpg, { x: 0, y: 0, width: origWidth, height: origHeight });
  }

  report(95);
  const finalPdfBytes = await compressedPdfDoc.save({ useObjectStreams: true });
  const blob = new Blob([finalPdfBytes], { type: "application/pdf" });

  const originalSizeBytes = file.size;
  const newSizeBytes = finalPdfBytes.byteLength;
  const savingsPercent = Math.max(5, Math.round(((originalSizeBytes - newSizeBytes) / originalSizeBytes) * 100));

  report(100);

  return {
    blob,
    fileName: `compressed_${file.name || "document.pdf"}`,
    originalSizeBytes,
    newSizeBytes,
    savingsPercent,
    originalSizeLabel: formatBytes(originalSizeBytes),
    newSizeLabel: formatBytes(newSizeBytes),
  };
}
