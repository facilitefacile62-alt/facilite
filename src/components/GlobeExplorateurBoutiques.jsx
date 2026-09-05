"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { positionActuelle } from "@/lib/marketplaceData";

const STYLE_OPENFREEMAP = "https://tiles.openfreemap.org/styles/liberty";
const STYLE_POSITRON = "https://tiles.openfreemap.org/styles/bright";
const CENTRE_SENEGAL = [-17.4441, 14.6937]; // Dakar par défaut

// Collection de Bitmojis / Avatars stylisés inspirés de l'univers Snap Map
const AVATARS_SNAP = [
  { id: "femme1", emoji: "👩🏾‍🦱", style: "bg-emerald-500", label: "Mode & Tendance" },
  { id: "homme1", emoji: "👨🏾‍💼", style: "bg-blue-500", label: "Tech & Business" },
  { id: "femme2", emoji: "👩🏾‍💼", style: "bg-purple-500", label: "Beauté & Soins" },
  { id: "homme2", emoji: "🧑🏾‍💻", style: "bg-indigo-500", label: "Électronique" },
  { id: "femme3", emoji: "🧕🏾", style: "bg-amber-500", label: "Maison & Déco" },
  { id: "homme3", emoji: "🧢", style: "bg-rose-500", label: "Sport & Style" },
];

function urlPhoto(chemin) {
  if (!chemin) return "";
  if (chemin.startsWith("http://") || chemin.startsWith("https://")) return chemin;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kdtamtwbvogvuzkknbcu.supabase.co";
  return `${base}/storage/v1/object/public/marketplace/${chemin}`;
}

function prixLisible(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("fr-FR");
}

export default function GlobeExplorateurBoutiques({
  boutiques = [],
  tousArticles = [],
  onVoirBoutique,
  onVoirArticle,
  onFermer,
}) {
  const conteneurRef = useRef(null);
  const carteRef = useRef(null);
  const marqueursInstances = useRef([]);

  const [boutiqueSelectionnee, setBoutiqueSelectionnee] = useState(null);
  const [filtreActif, setFiltreActif] = useState("tous"); // 'tous' | 'visites' | 'populaires' | 'live'
  const [mode3DGlobe, setMode3DGlobe] = useState(false);
  const [styleActuel, setStyleActuel] = useState(STYLE_OPENFREEMAP);
  const [localisationEnCours, setLocalisationEnCours] = useState(false);
  const [erreurLocalisation, setErreurLocalisation] = useState("");
  const [maPosition, setMaPosition] = useState(null);
  const [vueBoutiqueDetails, setVueBoutiqueDetails] = useState(false);

  // Filtrer les boutiques ayant des coordonnées valides
  const marqueurs = useMemo(() => {
    return boutiques.filter(
      (b) => Number.isFinite(b.lat) && Number.isFinite(b.lng) && (b.lat !== 0 || b.lng !== 0)
    );
  }, [boutiques]);

  // Initialisation de la carte MapLibre GL
  useEffect(() => {
    if (!conteneurRef.current) return;

    let carte;
    try {
      carte = new maplibregl.Map({
        container: conteneurRef.current,
        style: styleActuel,
        center: marqueurs[0] ? [marqueurs[0].lng, marqueurs[0].lat] : CENTRE_SENEGAL,
        zoom: 12.8,
        pitch: 45, // Vue 3D inclinée style Snap Map
        bearing: -10,
        attributionControl: false,
        preserveDrawingBuffer: true,
      });
    } catch {
      return;
    }

    carteRef.current = carte;

    carte.on("load", () => {
      if (mode3DGlobe) {
        carte.setProjection({ type: "globe" });
      }
    });

    return () => {
      marqueursInstances.current.forEach((m) => m.remove());
      marqueursInstances.current = [];
      carte.remove();
    };
  }, [styleActuel, mode3DGlobe, marqueurs]);

  // Ajout et mise à jour des marqueurs stylisés Snap Map
  useEffect(() => {
    const carte = carteRef.current;
    if (!carte) return;

    // Nettoyer anciens marqueurs
    marqueursInstances.current.forEach((m) => m.remove());
    marqueursInstances.current = [];

    marqueurs.forEach((b, idx) => {
      const avatarInfo = AVATARS_SNAP[idx % AVATARS_SNAP.length];
      const aPhoto = b.photo ? urlPhoto(b.photo) : null;
      const nomCourt = b.nom || "Boutique Facilité";
      const quartier = b.quartier || b.ville || "Dakar";

      // Conteneur principal du Bitmoji / Marqueur Snap Map
      const el = document.createElement("div");
      el.className = "snap-marker-container group relative cursor-pointer select-none transition-transform duration-300 hover:scale-110";
      el.style.display = "flex";
      el.style.flexDirection = "column";
      el.style.alignItems = "center";

      // 1. Bulle de statut / Nom de la boutique (Style Snap Map Pill)
      const bulle = document.createElement("div");
      bulle.className =
        "mb-1 px-2.5 py-1 bg-white/95 dark:bg-gray-900/95 text-gray-900 dark:text-white rounded-full text-[10px] font-black shadow-lg border border-gray-200/80 dark:border-gray-700/80 flex items-center gap-1.5 whitespace-nowrap backdrop-blur-xs transition-all transform group-hover:-translate-y-1";
      bulle.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span class="font-extrabold max-w-[110px] truncate">${nomCourt}</span>
        <span class="text-[8px] font-bold text-gray-500">· ${quartier}</span>
      `;
      el.appendChild(bulle);

      // 2. Story Ring avec Photo du produit ou Logo (Cercle Vert Pulsant Snap Map)
      const storyRing = document.createElement("div");
      storyRing.className =
        "relative w-12 h-12 rounded-full p-[2.5px] bg-gradient-to-tr from-emerald-400 to-green-500 shadow-xl flex items-center justify-center animate-bounce-subtle";
      
      const innerAvatar = document.createElement("div");
      innerAvatar.className = "w-full h-full rounded-full overflow-hidden bg-white dark:bg-gray-800 flex items-center justify-center border-2 border-white dark:border-gray-900";
      
      if (aPhoto) {
        innerAvatar.innerHTML = `<img src="${aPhoto}" alt="${nomCourt}" class="w-full h-full object-cover" />`;
      } else {
        innerAvatar.innerHTML = `<span class="text-xl">${avatarInfo.emoji}</span>`;
      }
      storyRing.appendChild(innerAvatar);

      // Badge LIVE sur le cercle de story
      const badgeLive = document.createElement("div");
      badgeLive.className =
        "absolute -bottom-1 bg-red-600 text-white text-[7px] font-black uppercase px-1.5 py-0.2 rounded-full border border-white shadow-xs";
      badgeLive.innerText = "LIVE";
      storyRing.appendChild(badgeLive);

      el.appendChild(storyRing);

      // 3. Ombre portée au sol style Bitmoji 3D
      const ombre = document.createElement("div");
      ombre.className = "w-8 h-2 bg-black/35 rounded-full blur-[1.5px] mt-0.5";
      el.appendChild(ombre);

      // Clic sur le marqueur : centrer et ouvrir la boutique
      el.addEventListener("click", () => {
        setBoutiqueSelectionnee(b);
        setVueBoutiqueDetails(true);
        carte.flyTo({
          center: [b.lng, b.lat],
          zoom: 15.5,
          pitch: 55,
          bearing: -15,
          speed: 1.2,
          curve: 1.4,
          essential: true,
        });
      });

      const marqueur = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([b.lng, b.lat])
        .addTo(carte);

      marqueursInstances.current.push(marqueur);
    });
  }, [marqueurs]);

  // Navigation vers la position de l'utilisateur
  const allerAMaPosition = async () => {
    setErreurLocalisation("");
    setLocalisationEnCours(true);
    try {
      const pos = await positionActuelle();
      setMaPosition(pos);

      // Création du marqueur "Moi" style Bitmoji avec faisceau radar
      const elMoi = document.createElement("div");
      elMoi.className = "relative flex flex-col items-center select-none cursor-pointer";
      elMoi.innerHTML = `
        <div class="absolute -inset-4 bg-sky-500/20 rounded-full animate-ping pointer-events-none"></div>
        <div class="relative w-12 h-12 rounded-full bg-gradient-to-tr from-sky-400 to-blue-600 p-0.5 shadow-2xl border-2 border-white flex items-center justify-center text-xl">
          <span>🧑🏾</span>
        </div>
        <div class="mt-1 px-2 py-0.5 bg-blue-600 text-white text-[9px] font-black rounded-full shadow-md border border-white">
          Vous êtes ici
        </div>
      `;

      new maplibregl.Marker({ element: elMoi, anchor: "bottom" })
        .setLngLat([pos.longitude, pos.latitude])
        .addTo(carteRef.current);

      carteRef.current?.flyTo({
        center: [pos.longitude, pos.latitude],
        zoom: 15,
        pitch: 50,
        bearing: 0,
        speed: 1.3,
        curve: 1.4,
        essential: true,
      });
    } catch (err) {
      setErreurLocalisation(err.message || "Impossible de récupérer votre position.");
    } finally {
      setLocalisationEnCours(false);
    }
  };

  // Sélection rapide d'une boutique depuis le carrousel inférieur
  const selectionnerBoutiqueCarousel = (b) => {
    setBoutiqueSelectionnee(b);
    setVueBoutiqueDetails(true);
    carteRef.current?.flyTo({
      center: [b.lng, b.lat],
      zoom: 15.5,
      pitch: 55,
      bearing: -15,
      speed: 1.2,
      curve: 1.4,
      essential: true,
    });
  };

  // Basculer la projection 3D Globe / Plan Mercator
  const toggleGlobe = () => {
    const nouveauMode = !mode3DGlobe;
    setMode3DGlobe(nouveauMode);
    if (carteRef.current) {
      carteRef.current.setProjection({ type: nouveauMode ? "globe" : "mercator" });
      if (nouveauMode) {
        carteRef.current.flyTo({ zoom: 3, pitch: 20 });
      } else {
        carteRef.current.flyTo({ zoom: 13, pitch: 45 });
      }
    }
  };

  // Basculer le style de carte
  const toggleStyle = () => {
    const nouveauStyle = styleActuel === STYLE_OPENFREEMAP ? STYLE_POSITRON : STYLE_OPENFREEMAP;
    setStyleActuel(nouveauStyle);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-[#0B0F17] overflow-hidden select-none font-sans"
      role="dialog"
      aria-modal="true"
      aria-label="Snap Map Explorateur des Boutiques"
    >
      {/* 1. EN-TÊTE SUPÉRIEUR SNAP MAP (Translucide avec Météo, Titre & Filtres) */}
      <header className="absolute top-0 inset-x-0 z-20 pt-3 pb-2 px-3 sm:px-5 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none flex flex-col gap-2">
        <div className="flex items-center justify-between">
          {/* Avatar Utilisateur Gauche */}
          <div className="pointer-events-auto flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full border-2 border-white/90 bg-gradient-to-tr from-amber-400 to-orange-500 shadow-md flex items-center justify-center text-lg">
              <span>👤</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-white font-black text-base sm:text-lg tracking-tight drop-shadow">
                  Dakar
                </h1>
                <span className="text-amber-300 text-xs font-bold drop-shadow">🌙 30°C</span>
              </div>
              <p className="text-white/80 text-[11px] font-medium drop-shadow flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {marqueurs.length} boutique{marqueurs.length > 1 ? "s" : ""} en direct
              </p>
            </div>
          </div>

          {/* Boutons d'action en haut à droite */}
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onFermer}
              className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer transition backdrop-blur-md border border-white/20 shadow-lg"
              aria-label="Fermer la carte"
              title="Retourner au Marketplace"
            >
              <i className="fa-solid fa-xmark text-base"></i>
            </button>
          </div>
        </div>

        {/* Pilules de filtres thématiques (Style Snap Map : Souvenirs, Les plus visités, Visité...) */}
        <div className="pointer-events-auto flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            type="button"
            onClick={() => setFiltreActif("tous")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shadow-md backdrop-blur-md ${
              filtreActif === "tous"
                ? "bg-white text-gray-950 font-black shadow-white/20"
                : "bg-black/50 text-white hover:bg-black/70 border border-white/15"
            }`}
          >
            <i className="fa-solid fa-compass text-xs text-sky-500"></i>
            <span>Toutes les boutiques</span>
          </button>

          <button
            type="button"
            onClick={() => setFiltreActif("populaires")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shadow-md backdrop-blur-md ${
              filtreActif === "populaires"
                ? "bg-white text-gray-950 font-black shadow-white/20"
                : "bg-black/50 text-white hover:bg-black/70 border border-white/15"
            }`}
          >
            <i className="fa-solid fa-trophy text-xs text-amber-400"></i>
            <span>Les plus visités</span>
          </button>

          <button
            type="button"
            onClick={() => setFiltreActif("live")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shadow-md backdrop-blur-md ${
              filtreActif === "live"
                ? "bg-white text-gray-950 font-black shadow-white/20"
                : "bg-black/50 text-white hover:bg-black/70 border border-white/15"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            <span>En stock (LIVE)</span>
          </button>

          <button
            type="button"
            onClick={allerAMaPosition}
            className="px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap bg-black/50 hover:bg-black/70 text-white border border-white/15 transition cursor-pointer flex items-center gap-1.5 shadow-md backdrop-blur-md"
          >
            <i className="fa-solid fa-clock-rotate-left text-xs text-emerald-400"></i>
            <span>Autour de moi</span>
          </button>
        </div>
      </header>

      {/* 2. CONTENEUR DE LA CARTE VECTORIELLE */}
      <div className="relative flex-1 w-full h-full">
        <div ref={conteneurRef} className="absolute inset-0 w-full h-full" />

        {/* 3. CONTRÔLES FLOTTANTS SNAP MAP (À droite) */}
        <aside className="absolute right-3.5 top-28 sm:top-24 z-20 flex flex-col gap-2.5">
          {/* Bouton Localisation "Ma position" */}
          <button
            type="button"
            onClick={allerAMaPosition}
            disabled={localisationEnCours}
            className="w-11 h-11 rounded-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white flex items-center justify-center shadow-xl border border-gray-200 dark:border-gray-700 hover:scale-105 active:scale-95 transition cursor-pointer relative group"
            title="Centrer sur ma position"
            aria-label="Ma position"
          >
            <i
              className={`fa-solid ${
                localisationEnCours ? "fa-spinner fa-spin text-blue-500" : "fa-location-arrow text-blue-600 text-base"
              }`}
            ></i>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-gray-900 animate-pulse" />
          </button>

          {/* Bouton Bascule Globe 3D / Plan 2D */}
          <button
            type="button"
            onClick={toggleGlobe}
            className="w-11 h-11 rounded-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white flex items-center justify-center shadow-xl border border-gray-200 dark:border-gray-700 hover:scale-105 active:scale-95 transition cursor-pointer"
            title={mode3DGlobe ? "Bascule Vue Rue Mercator" : "Bascule Vue Globe 3D"}
            aria-label="Vue Globe / Rue"
          >
            <span className="text-lg">{mode3DGlobe ? "🗺️" : "🌐"}</span>
          </button>

          {/* Bouton Thème Carte (Satellite / Clair) */}
          <button
            type="button"
            onClick={toggleStyle}
            className="w-11 h-11 rounded-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white flex items-center justify-center shadow-xl border border-gray-200 dark:border-gray-700 hover:scale-105 active:scale-95 transition cursor-pointer"
            title="Changer de vue"
            aria-label="Style de carte"
          >
            <i className="fa-solid fa-layer-group text-sm text-gray-700 dark:text-gray-300"></i>
          </button>
        </aside>

        {/* Message d'erreur géolocalisation */}
        {erreurLocalisation && (
          <div className="absolute top-28 left-1/2 -translate-x-1/2 z-30 bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-2xl shadow-xl animate-fadeIn max-w-[85%] text-center">
            {erreurLocalisation}
          </div>
        )}

        {/* 4. CARROUSEL INFÉRIEUR DE STORIES & BOUTIQUES (Style Snap Map Dock) */}
        <div className="absolute bottom-4 inset-x-0 z-20 px-3 sm:px-6 flex flex-col items-center gap-2 pointer-events-none">
          {/* Pilule d'information active (Style Snap Map "Just_Adama est à son domicile") */}
          <div className="pointer-events-auto px-4 py-2 rounded-full bg-[#1877F2]/90 hover:bg-[#1877F2] text-white text-xs font-extrabold shadow-xl backdrop-blur-md border border-white/20 flex items-center gap-2 cursor-pointer transition transform hover:scale-102">
            <i className="fa-solid fa-house text-xs"></i>
            <span>
              {boutiqueSelectionnee
                ? `${boutiqueSelectionnee.nom} est ouvert à ${boutiqueSelectionnee.quartier || "Dakar"}`
                : `${marqueurs.length} boutiques vérifiées prêtes à vous servir à Dakar`}
            </span>
          </div>

          {/* Barre des Avatars Snap Map Défilable Horizontalement */}
          <div className="pointer-events-auto w-full max-w-lg bg-white/90 dark:bg-gray-950/90 rounded-3xl p-2 sm:p-2.5 shadow-2xl border border-gray-200/80 dark:border-gray-800/80 backdrop-blur-md flex items-center gap-3 overflow-x-auto no-scrollbar">
            {marqueurs.map((b, idx) => {
              const avatar = AVATARS_SNAP[idx % AVATARS_SNAP.length];
              const aPhoto = b.photo ? urlPhoto(b.photo) : null;
              const estSelectionne = boutiqueSelectionnee?.id === b.id;

              return (
                <button
                  key={b.id || idx}
                  type="button"
                  onClick={() => selectionnerBoutiqueCarousel(b)}
                  className={`flex flex-col items-center gap-1 shrink-0 p-1.5 rounded-2xl transition-all cursor-pointer group ${
                    estSelectionne
                      ? "bg-blue-50 dark:bg-blue-950/50 scale-105"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  {/* Cercle Avatar avec contour Story vert */}
                  <div className="relative w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-emerald-400 to-green-500 shadow-md flex items-center justify-center">
                    <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-gray-800 flex items-center justify-center border border-white dark:border-gray-900">
                      {aPhoto ? (
                        <img src={aPhoto} alt={b.nom} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">{avatar.emoji}</span>
                      )}
                    </div>
                    {estSelectionne && (
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[8px] border-2 border-white">
                        ✓
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-black text-gray-800 dark:text-gray-200 max-w-[65px] truncate">
                    {b.nom}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. BOTTOM SHEET / FICHE BOUTIQUE DÉDIÉE (Style Snap Map Modal) */}
        {vueBoutiqueDetails && boutiqueSelectionnee && (
          <div
            className="absolute inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
            onClick={() => setVueBoutiqueDetails(false)}
          >
            <div
              className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col animate-slideUp"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag bar mobile */}
              <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mt-3 sm:hidden" />

              {/* Header Fiche Boutique */}
              <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black flex items-center justify-center text-lg shadow-md shrink-0 overflow-hidden">
                    {boutiqueSelectionnee.photo ? (
                      <img
                        src={urlPhoto(boutiqueSelectionnee.photo)}
                        alt={boutiqueSelectionnee.nom}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      boutiqueSelectionnee.nom?.substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm sm:text-base font-black text-gray-900 dark:text-white truncate">
                        {boutiqueSelectionnee.nom}
                      </h3>
                      <i className="fa-solid fa-circle-check text-sky-500 text-xs"></i>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate flex items-center gap-1">
                      <i className="fa-solid fa-location-dot text-[#1877F2]"></i>
                      {boutiqueSelectionnee.quartier ? `${boutiqueSelectionnee.quartier}, ` : ""}
                      {boutiqueSelectionnee.ville || "Dakar"} · Sénégal
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setVueBoutiqueDetails(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition cursor-pointer shrink-0"
                  aria-label="Fermer"
                >
                  <i className="fa-solid fa-xmark text-sm"></i>
                </button>
              </div>

              {/* Bouton WhatsApp Vert Grand Format */}
              <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800 bg-[#FAF6ED] dark:bg-amber-950/20">
                {boutiqueSelectionnee.whatsappUrl ? (
                  <a
                    href={boutiqueSelectionnee.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition cursor-pointer"
                  >
                    <i className="fa-brands fa-whatsapp text-lg"></i>
                    Discuter et commander sur WhatsApp
                  </a>
                ) : (
                  <p className="text-xs text-gray-500 text-center font-bold">
                    WhatsApp direct disponible auprès du vendeur
                  </p>
                )}
              </div>

              {/* Articles disponibles dans cette boutique */}
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <i className="fa-solid fa-store text-[#1877F2]"></i>
                    Articles en rayon ({boutiqueSelectionnee.articles?.length || 0})
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setVueBoutiqueDetails(false);
                      onVoirBoutique?.(boutiqueSelectionnee);
                    }}
                    className="text-xs font-bold text-[#1877F2] hover:underline cursor-pointer"
                  >
                    Voir la boutique
                  </button>
                </div>

                {boutiqueSelectionnee.articles && boutiqueSelectionnee.articles.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    {boutiqueSelectionnee.articles.map((art) => (
                      <div
                        key={art.id}
                        onClick={() => {
                          setVueBoutiqueDetails(false);
                          onVoirArticle?.(art);
                        }}
                        className="group p-2 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/80 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
                      >
                        <div className="aspect-square w-full rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 mb-1.5">
                          {art.photos?.[0] ? (
                            <img
                              src={urlPhoto(art.photos[0])}
                              alt={art.titre}
                              className="w-full h-full object-cover group-hover:scale-105 transition"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                              🛍️
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-gray-900 dark:text-white line-clamp-1">
                            {art.titre}
                          </p>
                          <p className="text-[11px] font-black text-[#1877F2] mt-0.5">
                            {prixLisible(art.prix_xof)} FCFA
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 text-center py-4">
                    Aucun article publié pour le moment.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
