"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useRef } from "react";
import OfferImageWatermark from "@/components/OfferImageWatermark";
import { parseOfferImages } from "@/lib/offerMedia";

/**
 * Génère automatiquement les hashtags LinkedIn pour une publication d'offre
 */
export function generateOfferHashtags(offer) {
  if (!offer) return ["#Recrutement", "#Emploi", "#Senegal"];
  const tags = [];

  // 1. Nom de l'entreprise (ex: #SDT)
  const rawCompany = (offer.company || "").replace(/[^a-zA-Z0-9]/g, "");
  if (rawCompany && rawCompany.length > 1) {
    tags.push(`#${rawCompany}`);
  }

  // 2. Tags récurrents d'emploi
  tags.push("#Recrutement", "#Emploi");

  // 3. Mots-clés extraits du titre (ex: #Communication #Marketing)
  const title = offer.title || offer.titleFR || "";
  const stopWords = new Set([
    "de", "du", "des", "le", "la", "les", "un", "une", "en", "pour", "et", "ou",
    "a", "au", "aux", "par", "sur", "dans", "avec", "sous", "responsable", "charge",
    "chef", "directeur", "recrutement", "urgent", "stage", "cdd", "cdi"
  ]);

  const words = title
    .toLowerCase()
    .replace(/[^a-zA-Z0-9à-ÿ\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));

  words.slice(0, 3).forEach((w) => {
    const capitalized = w.charAt(0).toUpperCase() + w.slice(1);
    tags.push(`#${capitalized}`);
  });

  // 4. Localisation & Pays
  const loc = (offer.location || "").toLowerCase();
  if (loc.includes("dakar")) tags.push("#Dakar");
  tags.push("#Senegal");

  // Déduplication insensible à la casse
  const seen = new Set();
  const finalTags = [];
  for (const t of tags) {
    const lower = t.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      finalTags.push(t);
    }
  }

  return finalTags.slice(0, 7);
}

/**
 * Composant de Publication Multi-Images / Document Multi-Pages (Style LinkedIn Document Post)
 * Reproduit fidèlement la maquette utilisateur :
 * 1. Hashtags en haut en bleu (#SDT #Recrutement #Emploi...)
 * 2. Badge supérieur gauche ("Recrutement [Nom] · X pages")
 * 3. Carrousel horizontal avec page active + aperçu (peek) de la page suivante ("Glissez ➔")
 * 4. Support complet de 2+ images avec défilement fluide, drag & drop à la souris et swipe tactile
 * 5. Bouton circulaire de navigation droite (›), gauche (‹) et bouton plein écran (⛶)
 * 6. Lightbox grand écran interactive avec miniatures et navigation clavier
 */
export default function OfferMediaGallery({
  media,
  title = "Affiche de recrutement",
  onEnlarge = null,
  showWatermark = true,
  className = "",
  maxHeight = "max-h-[380px] sm:max-h-[420px]",
  offer = null,
  showHashtags = true,
}) {
  const images = parseOfferImages(media);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  
  const scrollContainerRef = useRef(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasMovedRef = useRef(false);

  // Construction des slides
  const slides = [];

  if (images.length > 1) {
    // Plusieurs images fournies : chaque image devient une page du carrousel
    images.forEach((img, idx) => {
      slides.push({
        id: `img-${idx}`,
        type: "image",
        imageUrl: img,
        pageNumber: idx + 1,
      });
    });
  } else if (images.length === 1 && offer) {
    // 1 image avec données de poste : Expérience multi-pages LinkedIn complète
    slides.push({
      id: "slide-cover",
      type: "cover",
      imageUrl: images[0],
      pageNumber: 1,
    });
    slides.push({
      id: "slide-missions",
      type: "missions",
      imageUrl: images[0],
      pageNumber: 2,
    });
    slides.push({
      id: "slide-profil",
      type: "profil",
      imageUrl: images[0],
      pageNumber: 3,
    });
    slides.push({
      id: "slide-contact",
      type: "contact",
      imageUrl: images[0],
      pageNumber: 4,
    });
  } else if (images.length === 1) {
    // 1 image simple
    slides.push({
      id: "img-0",
      type: "image",
      imageUrl: images[0],
      pageNumber: 1,
    });
  } else if (offer) {
    // Offre sans image : Slides document générées
    slides.push({ id: "slide-cover", type: "cover", imageUrl: null, pageNumber: 1 });
    slides.push({ id: "slide-missions", type: "missions", imageUrl: null, pageNumber: 2 });
    slides.push({ id: "slide-profil", type: "profil", imageUrl: null, pageNumber: 3 });
    slides.push({ id: "slide-contact", type: "contact", imageUrl: null, pageNumber: 4 });
  }

  const totalPages = slides.length;
  const isMultiPage = totalPages > 1;
  const hashtags = offer ? generateOfferHashtags(offer) : [];

  // Informations de l'offre
  const companyName = offer?.company || "Entreprise Partenaire";
  const offerTitle = offer?.title || offer?.titleFR || title;
  const contractType = offer?.contract_type || offer?.contract || "CDD / CDI";
  const location = offer?.location || "Dakar, Sénégal";
  const deadline = offer?.deadline ? new Date(offer.deadline).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : null;

  // Découpage de la description
  const rawDesc = offer?.description || offer?.descFR || "";
  const lines = rawDesc.split("\n").map((l) => l.trim()).filter(Boolean);
  const missionIntro = lines.find((l) => l.length > 40) || rawDesc.slice(0, 220) || "Participer activement au développement et aux projets stratégiques de l'entreprise au sein d'une équipe dynamique.";

  // Titre du badge document
  const badgeTitle = offerTitle
    ? `Recrutement ${offerTitle.replace(/^Recrutement\s*/i, "")}`
    : `Recrutement ${companyName}`;

  // Défilement vers une slide spécifique
  const scrollToSlide = (idx) => {
    if (!scrollContainerRef.current) return;
    const targetIdx = Math.max(0, Math.min(idx, totalPages - 1));
    const container = scrollContainerRef.current;
    const slideElements = container.querySelectorAll(".carousel-slide-item");
    if (slideElements[targetIdx]) {
      const slide = slideElements[targetIdx];
      const targetLeft = slide.offsetLeft - container.offsetLeft - (container.clientWidth - slide.clientWidth) / 2;
      container.scrollTo({
        left: Math.max(0, targetLeft),
        behavior: "smooth",
      });
      setCurrentSlide(targetIdx);
    }
  };

  const nextSlide = (e) => {
    e?.stopPropagation();
    scrollToSlide(currentSlide < totalPages - 1 ? currentSlide + 1 : 0);
  };

  const prevSlide = (e) => {
    e?.stopPropagation();
    scrollToSlide(currentSlide > 0 ? currentSlide - 1 : totalPages - 1);
  };

  // Suivi du défilement pour mettre à jour l'index actif
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const slideElements = container.querySelectorAll(".carousel-slide-item");
    if (!slideElements.length) return;

    const containerCenter = container.scrollLeft + container.clientWidth / 2;
    let closestIndex = 0;
    let closestDist = Infinity;

    slideElements.forEach((el, idx) => {
      const elCenter = el.offsetLeft + el.clientWidth / 2;
      const dist = Math.abs(containerCenter - elCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = idx;
      }
    });

    setCurrentSlide(closestIndex);
  };

  // Gestion du Drag-to-Scroll à la souris
  const handleMouseDown = (e) => {
    if (!scrollContainerRef.current) return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startXRef.current = e.pageX - scrollContainerRef.current.offsetLeft;
    scrollLeftRef.current = scrollContainerRef.current.scrollLeft;
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.2;
    if (Math.abs(walk) > 6) {
      hasMovedRef.current = true;
    }
    scrollContainerRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleCardClick = (index, e) => {
    if (hasMovedRef.current) {
      e.stopPropagation();
      return;
    }
    openLightbox(index, e);
  };

  const openLightbox = (index, e) => {
    e?.stopPropagation();
    if (onEnlarge && slides[index]?.imageUrl) {
      onEnlarge(slides[index].imageUrl, index, images);
    } else {
      setLightboxIndex(index);
    }
  };

  // Clavier pour la lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowLeft") {
        setLightboxIndex((prev) => (prev > 0 ? prev - 1 : slides.length - 1));
      }
      if (e.key === "ArrowRight") {
        setLightboxIndex((prev) => (prev < slides.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, slides.length]);

  if (slides.length === 0) return null;

  return (
    <div className={`w-full ${className}`}>
      {/* 1. HASHTAGS EN HAUT (Style LinkedIn #SDT #Recrutement #Emploi...) */}
      {showHashtags && hashtags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2 px-0.5">
          {hashtags.map((tag, idx) => (
            <span
              key={idx}
              className="text-xs font-semibold text-[#0a66c2] hover:text-[#004182] dark:text-blue-400 hover:underline cursor-pointer transition select-none"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* 2. CONTENEUR DU CARROUSEL AVEC APERÇU (PEEK EFFECT) */}
      <div className="relative w-full rounded-2xl overflow-hidden bg-[#13171f] dark:bg-black border border-gray-200 dark:border-gray-800 shadow-md select-none group">
        
        {/* Badge supérieur gauche : "Recrutement responsable commun · 7 pages" */}
        {isMultiPage && (
          <div className="absolute top-3 left-3 z-30 bg-black/80 backdrop-blur-md text-white text-[11px] sm:text-xs font-medium px-3.5 py-1.5 rounded-full shadow-lg border border-white/10 flex items-center gap-2 pointer-events-none transition">
            <i className="fa-regular fa-file-lines text-emerald-400 text-xs shrink-0"></i>
            <span className="truncate max-w-[180px] sm:max-w-[280px] text-white/90">
              {badgeTitle}
            </span>
            <span className="text-gray-400">·</span>
            <span className="text-emerald-300 font-bold whitespace-nowrap">{totalPages} pages</span>
          </div>
        )}

        {/* Bouton Plein Écran en bas à droite (Icône Agrandir ⛶) */}
        <button
          type="button"
          onClick={(e) => openLightbox(currentSlide, e)}
          className="absolute bottom-3 right-3 z-30 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/75 hover:bg-black text-white flex items-center justify-center text-xs shadow-xl backdrop-blur-md transition border border-white/15 active:scale-90 cursor-pointer"
          title="Agrandir en plein écran"
        >
          <i className="fa-solid fa-expand text-xs sm:text-sm"></i>
        </button>

        {/* Flèche Droite Flottante (›) */}
        {isMultiPage && (
          <button
            type="button"
            onClick={nextSlide}
            className="absolute right-2 sm:right-3.5 top-1/2 -translate-y-1/2 z-30 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/80 hover:bg-black text-white flex items-center justify-center text-sm sm:text-base shadow-2xl backdrop-blur-md transition-all transform hover:scale-105 active:scale-95 cursor-pointer border border-white/20"
            title="Page suivante"
          >
            <i className="fa-solid fa-chevron-right text-sm sm:text-base"></i>
          </button>
        )}

        {/* Flèche Gauche Flottante (‹) */}
        {isMultiPage && currentSlide > 0 && (
          <button
            type="button"
            onClick={prevSlide}
            className="absolute left-2 sm:left-3.5 top-1/2 -translate-y-1/2 z-30 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/80 hover:bg-black text-white flex items-center justify-center text-sm sm:text-base shadow-2xl backdrop-blur-md transition-all transform hover:scale-105 active:scale-95 cursor-pointer border border-white/20"
            title="Page précédente"
          >
            <i className="fa-solid fa-chevron-left text-sm sm:text-base"></i>
          </button>
        )}

        {/* 3. TRACK DE DÉFILEMENT HORIZONTAL (PEEK VIEW EXACT 1:1) */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`relative w-full ${isMultiPage ? "flex gap-3 sm:gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory no-scrollbar p-3 sm:p-4" : "flex items-center justify-center p-0"} cursor-grab active:cursor-grabbing`}
        >
          {slides.map((slide, idx) => (
            <div
              key={slide.id || idx}
              onClick={(e) => handleCardClick(idx, e)}
              className={`carousel-slide-item relative ${
                isMultiPage
                  ? "w-[82%] sm:w-[72%] md:w-[68%] max-w-[440px] shrink-0 snap-start aspect-[4/5] sm:aspect-[16/11]"
                  : "w-full aspect-[4/5] sm:aspect-[16/10]"
              } ${maxHeight} rounded-xl sm:rounded-2xl overflow-hidden shadow-xl border border-white/10 transition-transform duration-200 cursor-pointer bg-gray-900 flex flex-col justify-between`}
            >
              {/* SLIDE TYPE : IMAGE DIRECTE */}
              {slide.type === "image" && (
                <div className="relative w-full h-full flex items-center justify-center bg-slate-950 overflow-hidden">
                  <img
                    src={slide.imageUrl}
                    alt={`${offerTitle} - Page ${slide.pageNumber}`}
                    className="w-full h-full object-contain"
                    loading={idx === 0 ? "eager" : "lazy"}
                  />
                  {showWatermark && <OfferImageWatermark />}
                  
                  {/* Badge "Glissez ➔" sur la première slide si multi-pages */}
                  {isMultiPage && idx === 0 && (
                    <div
                      onClick={nextSlide}
                      className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/75 hover:bg-black backdrop-blur-md text-white text-[11px] font-bold shadow-lg border border-white/20 transition cursor-pointer"
                    >
                      <span>Glissez</span>
                      <i className="fa-solid fa-circle-arrow-right text-yellow-400"></i>
                    </div>
                  )}
                </div>
              )}

              {/* SLIDE 1 : COUVERTURE BLUEPRINT / DARK */}
              {slide.type === "cover" && (
                <div className="relative w-full h-full flex flex-col justify-between p-5 sm:p-6 text-white overflow-hidden bg-gradient-to-br from-[#0c182a] via-[#10233e] to-[#0c182a]">
                  {/* Image en fond subtile */}
                  {slide.imageUrl && (
                    <img
                      src={slide.imageUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay scale-105 pointer-events-none"
                    />
                  )}
                  {/* Texture quadrillée */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:22px_22px] pointer-events-none"></div>

                  {/* Haut : Badge Offre d'emploi */}
                  <div className="relative z-10 pt-6 sm:pt-7">
                    <span className="inline-block px-3 py-1 rounded-md bg-[#d32f2f] text-white font-black text-[10px] sm:text-xs uppercase tracking-wider shadow-md">
                      Offre d&apos;emploi
                    </span>
                  </div>

                  {/* Centre : Titre & Détails du poste */}
                  <div className="relative z-10 my-auto py-2">
                    <h2 className="text-base sm:text-xl md:text-2xl font-black text-white leading-tight drop-shadow-md tracking-tight mb-3">
                      {offerTitle}
                    </h2>

                    <div className="space-y-1.5 text-xs sm:text-sm text-gray-200 font-medium">
                      <p className="flex items-center gap-2">
                        <strong className="text-white font-bold">Type de contrat :</strong>
                        <span className="text-emerald-300 font-bold">{contractType}</span>
                      </p>
                      <p className="flex items-start gap-2">
                        <strong className="text-white font-bold shrink-0">Localisation du poste :</strong>
                        <span className="text-gray-300 leading-snug">{location}</span>
                      </p>
                    </div>
                  </div>

                  {/* Bas : Logo & Glissez */}
                  <div className="relative z-10 flex items-end justify-between pt-3 border-t border-white/15">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center font-black text-white text-sm sm:text-base shadow-sm">
                        {companyName.slice(0, 3).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-black text-white leading-none truncate max-w-[120px] sm:max-w-[160px]">{companyName}</p>
                        <p className="text-[10px] text-emerald-400 font-bold mt-0.5">Recruteur vérifié</p>
                      </div>
                    </div>

                    <div
                      onClick={nextSlide}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md text-white text-xs font-black transition cursor-pointer shadow-md active:scale-95"
                    >
                      <span>Glissez</span>
                      <i className="fa-solid fa-circle-arrow-right text-sm text-yellow-300"></i>
                    </div>
                  </div>

                  {showWatermark && <OfferImageWatermark />}
                </div>
              )}

              {/* SLIDE 2 : MISSION PRINCIPALE & ACTIVITÉS (Page Blanche Exacte) */}
              {slide.type === "missions" && (
                <div className="relative w-full h-full bg-[#FAF9F6] text-gray-900 p-5 sm:p-6 flex flex-col justify-between overflow-y-auto">
                  {/* Grille papier subtile */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000006_1px,transparent_1px),linear-gradient(to_bottom,#00000006_1px,transparent_1px)] bg-[size:18px_18px] pointer-events-none"></div>

                  <div className="relative z-10 pt-4 sm:pt-5">
                    {/* Rubrique 1 : MISSION PRINCIPALE */}
                    <h3 className="text-xs sm:text-sm font-black text-[#d32f2f] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      Mission Principale
                    </h3>
                    <p className="text-[11px] sm:text-xs text-gray-700 leading-relaxed mb-4">
                      {missionIntro}
                    </p>

                    {/* Rubrique 2 : ACTIVITÉS ET RESPONSABILITÉS */}
                    <h3 className="text-xs sm:text-sm font-black text-[#d32f2f] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      Activités et Responsabilités
                    </h3>
                    <p className="text-xs font-bold text-gray-900 mb-2">
                      Stratégie &amp; pilotage opérationnel :
                    </p>
                    <ul className="space-y-1.5 text-[11px] sm:text-xs text-gray-700 pl-1">
                      <li className="flex items-start gap-2">
                        <span className="text-[#d32f2f] font-black shrink-0">•</span>
                        <span>Élaborer et piloter le plan d&apos;action aligné sur les objectifs de croissance.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#d32f2f] font-black shrink-0">•</span>
                        <span>Définir et suivre le budget alloué et en optimiser le rendement opérationnel.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#d32f2f] font-black shrink-0">•</span>
                        <span>Assurer une veille continue du marché, de la concurrence et des opportunités.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#d32f2f] font-black shrink-0">•</span>
                        <span>Rendre compte régulièrement des indicateurs clés de performance à la Direction.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Pied de slide document */}
                  <div className="relative z-10 pt-3 border-t border-gray-200 flex items-center justify-between text-[10px] text-gray-500 font-bold">
                    <span>{companyName} · Fiche officielle</span>
                    <span className="text-[#d32f2f] cursor-pointer hover:underline" onClick={nextSlide}>
                      Suivant ➔
                    </span>
                  </div>
                </div>
              )}

              {/* SLIDE 3 : PROFIL RECHERCHÉ & EXIGENCES */}
              {slide.type === "profil" && (
                <div className="relative w-full h-full bg-[#FAF9F6] text-gray-900 p-5 sm:p-6 flex flex-col justify-between overflow-y-auto">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000006_1px,transparent_1px),linear-gradient(to_bottom,#00000006_1px,transparent_1px)] bg-[size:18px_18px] pointer-events-none"></div>

                  <div className="relative z-10 pt-4 sm:pt-5">
                    <h3 className="text-xs sm:text-sm font-black text-[#d32f2f] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      Profil Recherché
                    </h3>
                    <ul className="space-y-1.5 text-[11px] sm:text-xs text-gray-700 mb-4 pl-1">
                      <li className="flex items-start gap-2">
                        <span className="text-[#d32f2f] font-black shrink-0">•</span>
                        <span>Formation supérieure requise avec expérience confirmée sur un poste similaire.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#d32f2f] font-black shrink-0">•</span>
                        <span>Aisance relationnelle, sens aigu de l&apos;organisation et esprit d&apos;équipe.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#d32f2f] font-black shrink-0">•</span>
                        <span>Rigueur, proactivité et capacité d&apos;adaptation rapide.</span>
                      </li>
                    </ul>

                    <h3 className="text-xs sm:text-sm font-black text-[#d32f2f] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      Compétences &amp; Outils
                    </h3>
                    <ul className="space-y-1.5 text-[11px] sm:text-xs text-gray-700 pl-1">
                      <li className="flex items-start gap-2">
                        <span className="text-[#d32f2f] font-black shrink-0">•</span>
                        <span>Maîtrise des logiciels professionnels et outils digitaux du secteur.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#d32f2f] font-black shrink-0">•</span>
                        <span>Excellente communication écrite et orale.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="relative z-10 pt-3 border-t border-gray-200 flex items-center justify-between text-[10px] text-gray-500 font-bold">
                    <span>{companyName} · Critères</span>
                    <span className="text-[#d32f2f] cursor-pointer hover:underline" onClick={nextSlide}>
                      Modalités ➔
                    </span>
                  </div>
                </div>
              )}

              {/* SLIDE 4 : MODALITÉS DE CANDIDATURE */}
              {slide.type === "contact" && (
                <div className="relative w-full h-full bg-gradient-to-br from-[#0c182a] via-[#10233e] to-[#0c182a] p-5 sm:p-6 text-white flex flex-col justify-between">
                  <div className="relative z-10 pt-4 sm:pt-5">
                    <span className="inline-block px-3 py-1 rounded-md bg-[#d32f2f] text-white font-black text-[10px] sm:text-xs uppercase tracking-wider shadow-md mb-3">
                      Modalités de Candidature
                    </span>

                    <h3 className="text-sm sm:text-lg font-black text-white mb-2">
                      Comment postuler à cette opportunité ?
                    </h3>

                    <div className="space-y-2 text-xs text-gray-200 mb-3">
                      {deadline && (
                        <p className="flex items-center gap-2">
                          <i className="fa-solid fa-calendar-xmark text-rose-400"></i>
                          <span>Date limite : <strong className="text-white">{deadline}</strong></span>
                        </p>
                      )}
                      <p className="flex items-center gap-2">
                        <i className="fa-solid fa-location-dot text-emerald-400"></i>
                        <span>Lieu : <strong className="text-white">{location}</strong></span>
                      </p>
                      <p className="flex items-center gap-2">
                        <i className="fa-solid fa-briefcase text-blue-400"></i>
                        <span>Contrat : <strong className="text-white">{contractType}</strong></span>
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white/10 border border-white/15 text-[11px] text-gray-300">
                      <p className="font-bold text-white mb-0.5">Dossier requis :</p>
                      <p>CV actualisé + Lettre de motivation détaillée.</p>
                    </div>
                  </div>

                  <div className="relative z-10 pt-3 border-t border-white/15 flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-400">Postulez directement ci-dessous ⬇️</span>
                    <span className="text-[11px] text-gray-400 cursor-pointer hover:underline" onClick={() => scrollToSlide(0)}>
                      1ère page ↺
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 4. BARRE DE PROGRESSION INFÉRIEURE / POINTS DE PAGINATION */}
        {isMultiPage && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-xs">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  scrollToSlide(idx);
                }}
                className={`transition-all rounded-full cursor-pointer ${
                  currentSlide === idx
                    ? "w-5 h-1.5 bg-emerald-400 shadow-xs"
                    : "w-1.5 h-1.5 bg-white/40 hover:bg-white/75"
                }`}
                aria-label={`Page ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* 5. VISIONNEUSE LIGHTBOX PLEIN ÉCRAN INTERACTIVE */}
      {lightboxIndex !== null && typeof lightboxIndex === "number" && (
        <div
          className="fixed inset-0 z-[999999] bg-black/95 backdrop-blur-md flex flex-col justify-between p-3 sm:p-6 animate-in fade-in select-none"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Header Lightbox */}
          <div
            className="flex items-center justify-between text-white z-30 pb-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-black text-emerald-400 border border-white/10">
                Page {lightboxIndex + 1} / {totalPages}
              </span>
              <h4 className="text-xs sm:text-sm font-bold text-gray-200 truncate max-w-[200px] sm:max-w-md">
                {offerTitle} - {companyName}
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

          {/* Contenu de la Slide en Grand */}
          <div
            className="relative flex-1 flex items-center justify-center overflow-hidden my-auto max-w-4xl mx-auto w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {totalPages > 1 && (
              <button
                type="button"
                onClick={() =>
                  setLightboxIndex((prev) => (prev > 0 ? prev - 1 : totalPages - 1))
                }
                className="absolute left-2 sm:left-4 z-20 w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center text-lg transition backdrop-blur-xs border border-white/10 active:scale-95 cursor-pointer shadow-lg"
                title="Page précédente (←)"
              >
                <i className="fa-solid fa-chevron-left"></i>
              </button>
            )}

            {slides[lightboxIndex]?.imageUrl ? (
              <div className="relative max-w-full max-h-[75vh] flex items-center justify-center">
                <img
                  src={slides[lightboxIndex].imageUrl}
                  alt={`${offerTitle} - Page ${lightboxIndex + 1}`}
                  className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200"
                />
                {showWatermark && <OfferImageWatermark />}
              </div>
            ) : (
              <div className="w-full max-w-xl aspect-[4/5] bg-slate-900 rounded-2xl p-8 text-white flex flex-col justify-between shadow-2xl border border-white/10">
                <div>
                  <span className="px-3 py-1 rounded-md bg-[#d32f2f] text-white font-black text-xs uppercase">
                    Offre d&apos;emploi
                  </span>
                  <h2 className="text-2xl font-black text-white mt-4">{offerTitle}</h2>
                  <p className="text-sm text-gray-300 mt-2">{companyName} · {location}</p>
                  <p className="text-xs text-gray-400 mt-4 leading-relaxed">{missionIntro}</p>
                </div>
                <p className="text-xs text-emerald-400 font-bold">Postulez directement sur Facilité</p>
              </div>
            )}

            {totalPages > 1 && (
              <button
                type="button"
                onClick={() =>
                  setLightboxIndex((prev) => (prev < totalPages - 1 ? prev + 1 : 0))
                }
                className="absolute right-2 sm:right-4 z-20 w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center text-lg transition backdrop-blur-xs border border-white/10 active:scale-95 cursor-pointer shadow-lg"
                title="Page suivante (→)"
              >
                <i className="fa-solid fa-chevron-right"></i>
              </button>
            )}
          </div>

          {/* Miniatures défilables en bas de lightbox */}
          {totalPages > 1 && (
            <div
              className="flex items-center justify-center gap-2 overflow-x-auto py-2 z-30 no-scrollbar max-w-2xl mx-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {slides.map((s, idx) => (
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
                  {s.imageUrl ? (
                    <img src={s.imageUrl} alt={`Page ${idx + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-slate-800 flex items-center justify-center text-[10px] text-white font-bold">
                      P.{idx + 1}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
