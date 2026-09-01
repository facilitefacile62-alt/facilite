"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect } from "react";
import OfferImageWatermark from "@/components/OfferImageWatermark";
import { parseOfferImages } from "@/lib/offerMedia";

export default function OfferMediaGallery({
  media,
  title = "Affiche de recrutement",
  onEnlarge = null,
  showWatermark = true,
  className = "",
  maxHeight = "max-h-[380px]",
}) {
  const images = parseOfferImages(media);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  // Gestion des touches du clavier pour naviguer dans la visionneuse
  useEffect(() => {
    if (lightboxIndex === null || !Array.isArray(images) || images.length === 0) return;

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
  }, [lightboxIndex, images]);

  if (!images || !Array.isArray(images) || images.length === 0) return null;

  const handleOpenLightbox = (index, e) => {
    e?.stopPropagation?.();
    if (onEnlarge) {
      onEnlarge(images[index], index, images);
    } else {
      setLightboxIndex(index);
    }
  };

  return (
    <>
      <div className={`relative w-full rounded-2xl overflow-hidden bg-gray-950 border border-gray-200/80 dark:border-gray-800 shadow-xs ${className}`}>
        
        {/* --- CAS 1 PHOTO --- */}
        {images.length === 1 && (
          <div
            onClick={(e) => handleOpenLightbox(0, e)}
            className={`relative w-full ${maxHeight} min-h-[200px] flex items-center justify-center overflow-hidden group cursor-pointer`}
          >
            <img
              src={images[0]}
              alt={title}
              className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
              loading="eager"
            />
            {/* Bouton Agrandir */}
            <div className="absolute top-2.5 right-2.5 bg-black/60 hover:bg-black/85 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-xs flex items-center gap-1.5 z-20 transition opacity-90 group-hover:opacity-100 shadow-md">
              <i className="fa-solid fa-magnifying-glass-plus text-xs"></i>
              <span>Agrandir</span>
            </div>
            {showWatermark && <OfferImageWatermark />}
          </div>
        )}

        {/* --- CAS 2 PHOTOS : GRILLE CÔTE À CÔTE --- */}
        {images.length === 2 && (
          <div className="grid grid-cols-2 gap-1 w-full aspect-[16/10] sm:aspect-[16/9] min-h-[220px]">
            {images.map((img, idx) => (
              <div
                key={idx}
                onClick={(e) => handleOpenLightbox(idx, e)}
                className="relative w-full h-full overflow-hidden group cursor-pointer bg-black/40"
              >
                <img
                  src={img}
                  alt={`${title} - Photo ${idx + 1}`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition shadow-xs">
                  <i className="fa-solid fa-magnifying-glass-plus mr-1"></i> Voir
                </div>
              </div>
            ))}
            {showWatermark && <OfferImageWatermark />}
          </div>
        )}

        {/* --- CAS 3 PHOTOS : 1 GRANDE + 2 EMPILÉES --- */}
        {images.length === 3 && (
          <div className="grid grid-cols-3 gap-1 w-full aspect-[16/10] sm:aspect-[16/9] min-h-[230px]">
            {/* Grande photo à gauche (2/3 de largeur) */}
            <div
              onClick={(e) => handleOpenLightbox(0, e)}
              className="col-span-2 relative w-full h-full overflow-hidden group cursor-pointer bg-black/40"
            >
              <img
                src={images[0]}
                alt={`${title} - Photo 1`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute top-2 left-2 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-xs">
                📸 3 photos
              </div>
            </div>

            {/* 2 petites photos à droite (1/3 de largeur empilées) */}
            <div className="col-span-1 grid grid-rows-2 gap-1 h-full">
              {images.slice(1, 3).map((img, idx) => (
                <div
                  key={idx + 1}
                  onClick={(e) => handleOpenLightbox(idx + 1, e)}
                  className="relative w-full h-full overflow-hidden group cursor-pointer bg-black/40"
                >
                  <img
                    src={img}
                    alt={`${title} - Photo ${idx + 2}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
                </div>
              ))}
            </div>
            {showWatermark && <OfferImageWatermark />}
          </div>
        )}

        {/* --- CAS 4 PHOTOS ET PLUS : GRILLE 4 CASES AVEC OVERLAY COMPTEUR --- */}
        {images.length >= 4 && (
          <div className="grid grid-cols-2 gap-1 w-full aspect-[16/11] sm:aspect-[16/9] min-h-[240px]">
            {images.slice(0, 4).map((img, idx) => {
              const isLastVisible = idx === 3;
              const remainingCount = images.length - 4;

              return (
                <div
                  key={idx}
                  onClick={(e) => handleOpenLightbox(idx, e)}
                  className="relative w-full h-full overflow-hidden group cursor-pointer bg-black/40"
                >
                  <img
                    src={img}
                    alt={`${title} - Photo ${idx + 1}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* Overlay "+N photos" sur la 4ème vignette */}
                  {isLastVisible && remainingCount > 0 && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-2xs flex flex-col items-center justify-center text-white z-10 transition group-hover:bg-black/70">
                      <span className="text-xl sm:text-2xl font-black tracking-tight">+{remainingCount + 1}</span>
                      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-300">
                        Voir tout
                      </span>
                    </div>
                  )}

                  {/* Badge compteur discret sur la 1ère */}
                  {idx === 0 && (
                    <div className="absolute top-2 left-2 bg-black/70 text-white text-[10px] font-black px-2 py-0.5 rounded-md backdrop-blur-xs z-10">
                      📸 {images.length} photos
                    </div>
                  )}
                </div>
              );
            })}
            {showWatermark && <OfferImageWatermark />}
          </div>
        )}
      </div>

      {/* --- VISIONNEUSE LIGHTBOX PLEIN ÉCRAN INTERACTIVE --- */}
      {lightboxIndex !== null && typeof lightboxIndex === "number" && images[lightboxIndex] && (
        <div
          className="fixed inset-0 z-[999999] bg-black/95 backdrop-blur-md flex flex-col justify-between p-3 sm:p-6 animate-in fade-in select-none"
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
