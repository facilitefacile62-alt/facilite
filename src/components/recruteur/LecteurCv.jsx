"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";

// Lecteur de CV intégré, sans bouton de téléchargement : le PDF est dessiné page par page sur des canvas (fonctionne aussi sur les
// téléphones, où un PDF ne s'affiche pas dans un cadre). pdf.js est servi par le site (public/pdfjs).
function chargerPdfJs() {
  if (typeof window === "undefined") return Promise.reject(new Error("navigateur requis"));
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/pdfjs/pdf.min.js";
    script.onload = () => {
      if (!window.pdfjsLib) return reject(new Error("pdf.js indisponible"));
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.js";
      resolve(window.pdfjsLib);
    };
    script.onerror = () => reject(new Error("pdf.js indisponible"));
    document.head.appendChild(script);
  });
}

function PagesPdf({ url }) {
  const zone = useRef(null);
  const [etat, setEtat] = useState("chargement");

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const pdfjs = await chargerPdfJs();
        const document_ = await pdfjs.getDocument({ url }).promise;
        const conteneur = zone.current;
        if (!conteneur || annule) return;
        conteneur.innerHTML = "";
        const largeur = Math.min(conteneur.clientWidth || 360, 900);
        for (let n = 1; n <= Math.min(document_.numPages, 15); n += 1) {
          const page = await document_.getPage(n);
          if (annule) return;
          const base = page.getViewport({ scale: 1 });
          const vue = page.getViewport({ scale: (largeur / base.width) * Math.min(window.devicePixelRatio || 1, 2) });
          const canvas = document.createElement("canvas");
          canvas.width = vue.width;
          canvas.height = vue.height;
          canvas.style.width = "100%";
          canvas.style.display = "block";
          canvas.style.marginBottom = "8px";
          canvas.style.background = "#fff";
          conteneur.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext("2d"), viewport: vue }).promise;
        }
        if (!annule) setEtat("pret");
      } catch (err) {
        console.error("Lecteur de CV :", err);
        if (!annule) setEtat("erreur");
      }
    })();
    return () => {
      annule = true;
    };
  }, [url]);

  return (
    <>
      {etat === "chargement" && <p className="text-xs text-gray-500 text-center py-6">Chargement du CV…</p>}
      {etat === "erreur" && <p className="text-xs text-red-600 text-center py-6">Impossible d&apos;afficher ce CV. Fermez et rouvrez-le.</p>}
      <div ref={zone} />
    </>
  );
}

export default function LecteurCv({ titre, cv, onFermer }) {
  return (
    <div className="fixed inset-0 z-[10000] bg-black/70 flex items-stretch sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label={`CV de ${titre}`}>
      <div className="bg-gray-100 w-full sm:max-w-3xl sm:rounded-2xl flex flex-col max-h-[100dvh] sm:max-h-[92vh] overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <p className="text-sm font-extrabold text-gray-900 truncate">CV de {titre}</p>
          <button type="button" onClick={onFermer} className="px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-extrabold cursor-pointer">
            Fermer
          </button>
        </div>
        <div className="overflow-auto p-3 select-none" onContextMenu={(e) => e.preventDefault()}>
          {cv.type === "pdf" && <PagesPdf url={cv.url} />}
          {cv.type === "image" && <img src={cv.url} alt={`CV de ${titre}`} draggable={false} className="w-full rounded-lg bg-white" />}
          {cv.type === "texte" && <pre className="whitespace-pre-wrap font-sans text-xs text-gray-800 bg-white rounded-lg p-4">{cv.texte}</pre>}
          {cv.type === "indisponible" && (
            <p className="text-xs text-gray-600 text-center py-8">Aperçu non disponible pour ce format de fichier. Demandez au candidat un CV en PDF.</p>
          )}
        </div>
      </div>
    </div>
  );
}
