"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect } from "react";
import ImageAdaptative from "@/components/ImageAdaptative";
import OfferImageWatermark from "@/components/OfferImageWatermark";
import { parseOfferImages } from "@/lib/offerMedia";

export default function OfferMediaGallery({
  media,
  title = "Affiche de recrutement",
  onEnlarge = null,
  showWatermark = true,
  className = "",
}) {
  const images = parseOfferImages(media);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  // Gestion des touches du clavier pour naviguer dans la visionneuse
  useEffect(() => {
    if (lightboxIndex === null) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowLeft") {
        setLightboxIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
      }
      if (e.key === "ArrowRight") {
        setLightboxIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, images.length]);

  if (!images || images.length === 0) return null;

  const handleOpenLightbox = (index, e) => {
    e?.stopPropagation();
    if (onEnlarge) {
      onEnlarge(images[index], index, images);
    } else {
      setLightboxIndex(index);
    }
  };

  return (
    <>
      {/* Photo de couverture au format réel de l'image (aucun recadrage, aucune bande),
          puis les autres photos en vignettes de même hauteur, chacune à son propre format. */}
      <div className={`relative w-full rounded-2xl overflow-hidden bg-gray-100 dark:bg-zinc-900 border border-gray-200/80 dark:border-gray-800 shadow-xs ${className}`}>
        <ImageAdaptative
          src={images[0]}
          alt={images.length > 1 ? `${title} - Photo 1` : title}
          loading="eager"
          onClick={(e) => handleOpenLightbox(0, e)}
          className="group cursor-pointer"
        >
          {/* Bouton Agrandir */}
          <div className="absolute top-2.5 right-2.5 bg-black/60 hover:bg-black/85 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 z-20 transition opacity-90 group-hover:opacity-100 shadow-md">
            <i className="fa-solid fa-magnifying-glass-plus text-xs"></i>
            <span>Agrandir</span>
          </div>
          {images.length > 1 && (
            <div className="absolute top-2.5 left-2.5 bg-black/70 text-white text-[10px] font-black px-2 py-0.5 rounded-md z-20">
              📸 {images.length} photos
            </div>
          )}
          {showWatermark && <OfferImageWatermark />}
        </ImageAdaptative>

        {images.length > 1 && (
          <div className="flex items-center gap-1 p-1 overflow-x-auto no-scrollbar bg-gray-100 dark:bg-zinc-900">
            {images.slice(1).map((img, idx) => (
              <button
                key={idx + 1}
                type="button"
                onClick={(e) => handleOpenLightbox(idx + 1, e)}
                className="flex-shrink-0 h-20 rounded-lg overflow-hidden cursor-pointer transition hover:opacity-90"
                title={`Voir la photo ${idx + 2}`}
              >
                <img
                  src={img}
                  alt={`${title} - Photo ${idx + 2}`}
                  className="h-full w-auto block"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* --- VISIONNEUSE LIGHTBOX PLEIN ÉCRAN INTERACTIVE --- */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[999999] bg-black/95 flex flex-col justify-between p-3 sm:p-6 animate-in fade-in select-none"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Header Lightbox : Titre, Compteur, Bouton Fermer */}
          <div
            className="flex items-center justify-between text-white z-30 pb-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-black text-emerald-400 border border-white/10">
                Photo {lightboxIndex + 1} / {images.length}
              </span>
              <h4 className="text-xs sm:text-sm font-bold text-gray-200 truncate max-w-[200px] sm:max-w-md">
                {title}
              </h4>
            </div>

            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center text-lg transition cursor-pointer"
              title="Fermer (Échap)"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          {/* Zone Image Centrale avec Flèches Précédent / Suivant */}
          <div
            className="relative flex-1 flex items-center justify-center overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Flèche Précédent */}
            {images.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setLightboxIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
                }
                className="absolute left-2 sm:left-4 z-20 w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center text-lg transition backdrop-blur-xs border border-white/10 active:scale-95 cursor-pointer shadow-lg"
                title="Photo précédente (←)"
              >
                <i className="fa-solid fa-chevron-left"></i>
              </button>
            )}

            {/* Photo Actuelle */}
            <div className="relative max-w-4xl max-h-[75vh] flex items-center justify-center">
              <img
                src={images[lightboxIndex]}
                alt={`${title} - Photo ${lightboxIndex + 1}`}
                className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200"
              />
              {showWatermark && <OfferImageWatermark />}
            </div>

            {/* Flèche Suivant */}
            {images.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setLightboxIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
                }
                className="absolute right-2 sm:right-4 z-20 w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center text-lg transition backdrop-blur-xs border border-white/10 active:scale-95 cursor-pointer shadow-lg"
                title="Photo suivante (→)"
              >
                <i className="fa-solid fa-chevron-right"></i>
              </button>
            )}
          </div>

          {/* Bandeau inférieur de vignettes défilables */}
          {images.length > 1 && (
            <div
              className="flex items-center justify-center gap-2 overflow-x-auto py-2 z-30 no-scrollbar max-w-2xl mx-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setLightboxIndex(idx)}
                  className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden flex-shrink-0 transition-all cursor-pointer border-2 ${
                    lightboxIndex === idx
                      ? "border-[#10E688] scale-105 shadow-lg shadow-emerald-500/20 ring-2 ring-[#10E688]/50"
                      : "border-white/20 opacity-50 hover:opacity-100 hover:scale-100"
                  }`}
                >
                  <img src={img} alt={`Vignette ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
