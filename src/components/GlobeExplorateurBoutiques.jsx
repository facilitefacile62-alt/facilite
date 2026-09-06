"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import "leaflet/dist/leaflet.css";
import { positionActuelle } from "@/lib/marketplaceData";

// Styles de tuiles ultra fluides & compatibles 100% mobiles (zéro WebGL crash)
const TUILES_SNAP_MAP = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const TUILES_SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const TUILES_DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

const CENTRE_SENEGAL = [14.6937, -17.4441]; // [lat, lng] Dakar

// Avatars Bitmoji stylisés universels
const AVATARS_SNAP = [
  { id: "femme1", emoji: "👩🏾‍🦱", label: "Mode & Tendance" },
  { id: "homme1", emoji: "👨🏾‍💼", label: "Tech & Business" },
  { id: "femme2", emoji: "👩🏾‍💼", label: "Beauté & Soins" },
  { id: "homme2", emoji: "🧑🏾‍💻", label: "Électronique" },
  { id: "femme3", emoji: "🧕🏾", label: "Maison & Déco" },
  { id: "homme3", emoji: "🧢", label: "Sport & Style" },
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
  const coucheTuilesRef = useRef(null);
  const groupeMarqueursRef = useRef(null);
  const marqueurMoiRef = useRef(null);

  const [boutiqueSelectionnee, setBoutiqueSelectionnee] = useState(null);
  const [filtreActif, setFiltreActif] = useState("tous"); // 'tous' | 'populaires' | 'live'
  const [styleActif, setStyleActif] = useState("snap"); // 'snap' | 'satellite' | 'dark'
  const [localisationEnCours, setLocalisationEnCours] = useState(false);
  const [erreurLocalisation, setErreurLocalisation] = useState("");
  const [vueBoutiqueDetails, setVueBoutiqueDetails] = useState(false);
  const [carteChargee, setCarteChargee] = useState(false);

  // Filtrer les boutiques avec coordonnées valides
  const marqueurs = useMemo(() => {
    return boutiques.filter(
      (b) => Number.isFinite(b.lat) && Number.isFinite(b.lng) && (b.lat !== 0 || b.lng !== 0)
    );
  }, [boutiques]);

  // Boutiques filtrées par pilule
  const boutiquesAffichees = useMemo(() => {
    if (filtreActif === "live") {
      return marqueurs.filter((b) => b.statut === "en_stock" || (b.articles && b.articles.some((a) => a.statut === "en_stock")));
    }
    if (filtreActif === "populaires") {
      return marqueurs.slice(0, Math.max(3, Math.ceil(marqueurs.length / 2)));
    }
    return marqueurs;
  }, [marqueurs, filtreActif]);

  // 1. Initialisation de la carte Leaflet (Universelle, zéro écran blanc)
  useEffect(() => {
    let annule = false;

    (async () => {
      if (!conteneurRef.current) return;
      try {
        const L = (await import("leaflet")).default;
        if (annule || !conteneurRef.current) return;

        // Détruire ancienne instance si existante
        if (carteRef.current) {
          carteRef.current.remove();
          carteRef.current = null;
        }

        const centreInitial = marqueurs[0]
          ? [marqueurs[0].lat, marqueurs[0].lng]
          : CENTRE_SENEGAL;

        const carte = L.map(conteneurRef.current, {
          center: centreInitial,
          zoom: 13,
          zoomControl: false,
          attributionControl: false,
        });

        carteRef.current = carte;

        // Couche de tuiles initiale
        const urlTuiles =
          styleActif === "satellite"
            ? TUILES_SATELLITE
            : styleActif === "dark"
            ? TUILES_DARK
            : TUILES_SNAP_MAP;

        const couche = L.tileLayer(urlTuiles, {
          maxZoom: 19,
          subdomains: "abcd",
        }).addTo(carte);

        coucheTuilesRef.current = couche;

        // Groupe pour les marqueurs
        groupeMarqueursRef.current = L.layerGroup().addTo(carte);

        // Forcer le redimensionnement pour éviter tout bug d'affichage
        setTimeout(() => {
          if (carteRef.current) {
            carteRef.current.invalidateSize();
            setCarteChargee(true);
          }
        }, 150);
      } catch {
        // En cas d'erreur de bundle, ignorer
      }
    })();

    return () => {
      annule = true;
      if (carteRef.current) {
        carteRef.current.remove();
        carteRef.current = null;
      }
    };
  }, [styleActif, marqueurs]);

  // 2. Rendu des Marqueurs Snap Map (Bitmojis, Story Rings & Bulles de Statut)
  const rafraichirMarqueurs = useCallback(async () => {
    const carte = carteRef.current;
    const groupe = groupeMarqueursRef.current;
    if (!carte || !groupe) return;

    const L = (await import("leaflet")).default;
    groupe.clearLayers();

    boutiquesAffichees.forEach((b, idx) => {
      const avatarInfo = AVATARS_SNAP[idx % AVATARS_SNAP.length];
      const aPhoto = b.photo ? urlPhoto(b.photo) : null;
      const nomCourt = b.nom || "Boutique";
      const quartier = b.quartier || b.ville || "Dakar";
      const estSelectionne = boutiqueSelectionnee?.id === b.id;

      const htmlMarqueur = `
        <div class="snap-marker flex flex-col items-center select-none cursor-pointer transform transition-transform duration-200 hover:scale-110 ${
          estSelectionne ? "scale-115 z-50" : "z-10"
        }">
          <!-- 1. Bulle de statut blanche style Snap Map -->
          <div class="mb-1 px-2.5 py-0.8 bg-white text-gray-900 rounded-full text-[10px] font-black shadow-lg border border-gray-200 flex items-center gap-1.5 whitespace-nowrap">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span class="font-extrabold max-w-[100px] truncate">${nomCourt}</span>
            <span class="text-[8px] font-bold text-gray-500">· ${quartier}</span>
          </div>

          <!-- 2. Story Ring Vert Pulsant avec Photo / Avatar -->
          <div class="relative w-12 h-12 rounded-full p-[2.5px] bg-gradient-to-tr from-emerald-400 to-green-500 shadow-xl flex items-center justify-center">
            <div class="w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center border-2 border-white shadow-xs">
              ${
                aPhoto
                  ? `<img src="${aPhoto}" alt="${nomCourt}" class="w-full h-full object-cover" />`
                  : `<span class="text-xl">${avatarInfo.emoji}</span>`
              }
            </div>
            <div class="absolute -bottom-1 bg-red-600 text-white text-[7px] font-black uppercase px-1.5 py-0.2 rounded-full border border-white shadow-xs">
              LIVE
            </div>
          </div>

          <!-- 3. Ombre portée au sol -->
          <div class="w-7 h-1.5 bg-black/40 rounded-full blur-[1px] mt-0.5"></div>
        </div>
      `;

      const icone = L.divIcon({
        html: htmlMarqueur,
        className: "snap-custom-icon",
        iconSize: [120, 80],
        iconAnchor: [60, 75],
      });

      const marqueur = L.marker([b.lat, b.lng], { icon: icone }).addTo(groupe);

      marqueur.on("click", () => {
        setBoutiqueSelectionnee(b);
        setVueBoutiqueDetails(true);
        carte.flyTo([b.lat, b.lng], 15, { duration: 1.2 });
      });
    });
  }, [boutiquesAffichees, boutiqueSelectionnee]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    rafraichirMarqueurs();
  }, [rafraichirMarqueurs, carteChargee]);

  // Centrer sur la position de l'utilisateur
  const allerAMaPosition = async () => {
    setErreurLocalisation("");
    setLocalisationEnCours(true);
    try {
      const pos = await positionActuelle();
      const L = (await import("leaflet")).default;
      const carte = carteRef.current;

      if (!carte) return;

      if (marqueurMoiRef.current) {
        marqueurMoiRef.current.remove();
      }

      const htmlMoi = `
        <div class="relative flex flex-col items-center select-none cursor-pointer">
          <div class="absolute -inset-3 bg-sky-500/30 rounded-full animate-ping pointer-events-none"></div>
          <div class="relative w-11 h-11 rounded-full bg-gradient-to-tr from-sky-400 to-blue-600 p-0.5 shadow-2xl border-2 border-white flex items-center justify-center text-lg">
            <span>🧑🏾</span>
          </div>
          <div class="mt-1 px-2 py-0.5 bg-blue-600 text-white text-[8px] font-black rounded-full shadow-md border border-white whitespace-nowrap">
            Vous êtes ici
          </div>
        </div>
      `;

      const iconeMoi = L.divIcon({
        html: htmlMoi,
        className: "snap-custom-moi",
        iconSize: [100, 70],
        iconAnchor: [50, 65],
      });

      marqueurMoiRef.current = L.marker([pos.latitude, pos.longitude], { icon: iconeMoi }).addTo(carte);
      carte.flyTo([pos.latitude, pos.longitude], 15, { duration: 1.3 });
    } catch (err) {
      setErreurLocalisation(err.message || "Impossible d'obtenir votre position GPS.");
    } finally {
      setLocalisationEnCours(false);
    }
  };

  // Sélection rapide depuis le carrousel inférieur
  const selectionnerBoutiqueCarousel = (b) => {
    setBoutiqueSelectionnee(b);
    setVueBoutiqueDetails(true);
    carteRef.current?.flyTo([b.lat, b.lng], 15, { duration: 1.2 });
  };

  // Basculer style de carte (Snap Pastel ↔ Satellite ↔ Nuit)
  const changerStyle = () => {
    const suivant = styleActif === "snap" ? "satellite" : styleActif === "satellite" ? "dark" : "snap";
    setStyleActif(suivant);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-[#F3F4F6] dark:bg-[#0B0F17] overflow-hidden select-none font-sans"
      role="dialog"
      aria-modal="true"
      aria-label="Explorateur Snap Map"
    >
      {/* 1. EN-TÊTE SUPÉRIEUR SNAP MAP (Translucide avec Météo, Titre & Filtres) */}
      <header className="absolute top-0 inset-x-0 z-20 pt-3 pb-2 px-3 sm:px-5 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none flex flex-col gap-2">
        <div className="flex items-center justify-between">
          {/* Avatar Utilisateur Gauche + Météo */}
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

          {/* Bouton Fermer (Croix en haut à droite) */}
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

        {/* Pilules de filtres thématiques (Style 1:1 Snap Map) */}
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
            <i className="fa-solid fa-location-crosshairs text-xs text-emerald-400"></i>
            <span>Autour de moi</span>
          </button>
        </div>
      </header>

      {/* 2. CONTENEUR CARTE LEAFLET */}
      <div className="relative flex-1 w-full h-full min-h-0">
        <div ref={conteneurRef} className="absolute inset-0 w-full h-full z-0" />

        {/* 3. CONTRÔLES FLOTTANTS SNAP MAP (À droite) */}
        <aside className="absolute right-3.5 top-28 sm:top-24 z-20 flex flex-col gap-2.5">
          {/* Bouton Ma Position */}
          <button
            type="button"
            onClick={allerAMaPosition}
            disabled={localisationEnCours}
            className="w-11 h-11 rounded-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white flex items-center justify-center shadow-xl border border-gray-200 dark:border-gray-700 hover:scale-105 active:scale-95 transition cursor-pointer relative"
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

          {/* Bouton Thème / Style Carte (Snap / Satellite / Sombre) */}
          <button
            type="button"
            onClick={changerStyle}
            className="w-11 h-11 rounded-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white flex items-center justify-center shadow-xl border border-gray-200 dark:border-gray-700 hover:scale-105 active:scale-95 transition cursor-pointer"
            title="Changer de vue (Plan / Satellite)"
            aria-label="Style de carte"
          >
            <span className="text-base">
              {styleActif === "snap" ? "🛰️" : styleActif === "satellite" ? "🌙" : "🗺️"}
            </span>
          </button>

          {/* Zoom In & Out */}
          <button
            type="button"
            onClick={() => carteRef.current?.zoomIn()}
            className="w-11 h-11 rounded-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white flex items-center justify-center shadow-xl border border-gray-200 dark:border-gray-700 hover:scale-105 active:scale-95 transition cursor-pointer"
            title="Zoomer"
            aria-label="Zoom avant"
          >
            <i className="fa-solid fa-plus text-sm"></i>
          </button>
          <button
            type="button"
            onClick={() => carteRef.current?.zoomOut()}
            className="w-11 h-11 rounded-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white flex items-center justify-center shadow-xl border border-gray-200 dark:border-gray-700 hover:scale-105 active:scale-95 transition cursor-pointer"
            title="Dézoomer"
            aria-label="Zoom arrière"
          >
            <i className="fa-solid fa-minus text-sm"></i>
          </button>
        </aside>

        {/* Message d'erreur géolocalisation */}
        {erreurLocalisation && (
          <div className="absolute top-28 left-1/2 -translate-x-1/2 z-30 bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-2xl shadow-xl max-w-[85%] text-center">
            {erreurLocalisation}
          </div>
        )}

        {/* 4. CARROUSEL INFÉRIEUR DE STORIES & BOUTIQUES (Style Snap Map Dock) */}
        <div className="absolute bottom-4 inset-x-0 z-20 px-3 sm:px-6 flex flex-col items-center gap-2 pointer-events-none">
          {/* Pilule d'information active */}
          <div className="pointer-events-auto px-4 py-2 rounded-full bg-[#1877F2]/95 hover:bg-[#1877F2] text-white text-xs font-extrabold shadow-xl backdrop-blur-md border border-white/20 flex items-center gap-2 cursor-pointer transition transform hover:scale-102">
            <i className="fa-solid fa-house text-xs"></i>
            <span>
              {boutiqueSelectionnee
                ? `${boutiqueSelectionnee.nom} est ouvert à ${boutiqueSelectionnee.quartier || "Dakar"}`
                : `${marqueurs.length} boutiques vérifiées prêtes à vous servir à Dakar`}
            </span>
          </div>

          {/* Barre des Avatars Snap Map Défilable Horizontalement */}
          <div className="pointer-events-auto w-full max-w-lg bg-white/95 dark:bg-gray-950/95 rounded-3xl p-2 sm:p-2.5 shadow-2xl border border-gray-200/80 dark:border-gray-800/80 backdrop-blur-md flex items-center gap-3 overflow-x-auto no-scrollbar">
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
