"use client";

// Carte des boutiques trouvées autour de l'acheteur.
//
// La liste triée par distance dit « 2,5 km » ; elle ne dit pas dans quelle
// direction. Pour quelqu'un qui ne connaît pas le quartier — le cas de la
// plupart des gens hors de leur commune — c'est l'information manquante.
//
// Ce composant reprend les choix déjà éprouvés par CarteItineraire, pour les
// mêmes raisons :
//  * Leaflet importé dynamiquement (il touche `window` dès l'évaluation) ;
//  * cercles vectoriels plutôt que les marqueurs par défaut, qui chargent des
//    PNG par une URL calculée à l'exécution — bloquée par la CSP, sans erreur
//    visible, donc une carte vide sans explication ;
//  * molette désactivée, la carte est au milieu d'une page qu'on fait défiler.
//
// Un point par BOUTIQUE, pas par article : trois articles de la même échoppe
// produiraient trois cercles superposés et un compteur illisible.
import { useEffect, useMemo, useRef, useState } from "react";

const COULEUR = "#1877F2";

/** Une coordonnée absente doit ressortir null, jamais 0 — `Number(null)` vaut 0. */
function point(lat, lng) {
  const a = lat === null || lat === undefined || lat === "" ? null : Number(lat);
  const b = lng === null || lng === undefined || lng === "" ? null : Number(lng);
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  return [a, b];
}

const distanceLisible = (km) =>
  km == null || !Number.isFinite(Number(km))
    ? ""
    : Number(km) < 1
      ? `${Math.round(Number(km) * 1000)} m`
      : `${String(Number(km)).replace(".", ",")} km`;

export default function CarteBoutiques({ articles, depart, onChoisirBoutique }) {
  const conteneur = useRef(null);
  const carteRef = useRef(null);
  const [echec, setEchec] = useState(false);
  
  // États de contrôle : Pliée / Dépliée et Mode Gain d'espace (Compact)
  const [estPliee, setEstPliee] = useState(false);
  const [modeCompact, setModeCompact] = useState(false);

  // Regroupement par boutique
  const boutiques = useMemo(() => {
    const par = new Map();
    for (const a of articles || []) {
      const p = point(a.boutique_lat, a.boutique_lng);
      if (!p) continue;
      const cle = a.boutique_id || `${p[0]},${p[1]}`;
      if (!par.has(cle)) {
        par.set(cle, {
          id: cle,
          nom: a.boutique_nom || "Boutique",
          quartier: a.quartier || null,
          distance_km: a.distance_km,
          position: p,
          articles: [],
        });
      }
      par.get(cle).articles.push(a);
    }
    return [...par.values()];
  }, [articles]);

  useEffect(() => {
    let annule = false;
    let carte = null;

    if (estPliee) {
      if (carteRef.current) {
        carteRef.current.remove();
        carteRef.current = null;
      }
      return;
    }

    (async () => {
      if (!conteneur.current || boutiques.length === 0) return;
      try {
        const L = (await import("leaflet")).default;
        await import("leaflet/dist/leaflet.css");
        if (annule || !conteneur.current) return;

        carte = L.map(conteneur.current, { scrollWheelZoom: false, attributionControl: true });
        carteRef.current = carte;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(carte);

        const points = [];

        for (const b of boutiques) {
          const enStock = b.articles.some((a) => a.statut === "en_stock");
          const marqueur = L.circleMarker(b.position, {
            radius: 9,
            color: enStock ? COULEUR : "#6b7280",
            weight: 3,
            fillColor: enStock ? COULEUR : "#9ca3af",
            fillOpacity: 0.85,
          }).addTo(carte);

          const lignes = [
            `<strong>${b.nom}</strong>`,
            b.quartier ? b.quartier : null,
            `${b.articles.length} article${b.articles.length > 1 ? "s" : ""} · ${distanceLisible(b.distance_km)}`,
          ].filter(Boolean);
          marqueur.bindTooltip(lignes.join("<br>"));

          if (typeof onChoisirBoutique === "function") {
            marqueur.on("click", () => onChoisirBoutique(b.id));
          }
          points.push(b.position);
        }

        const ici = point(depart?.latitude, depart?.longitude);
        if (ici) {
          L.circleMarker(ici, {
            radius: 7,
            color: "#dc2626",
            weight: 3,
            fillColor: "#dc2626",
            fillOpacity: 0.35,
          })
            .addTo(carte)
            .bindTooltip("Vous êtes ici");
          points.push(ici);
        }

        carte.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 15 });

        setTimeout(() => {
          if (!annule && carteRef.current) carteRef.current.invalidateSize();
        }, 200);
      } catch (err) {
        console.error("Carte des boutiques indisponible :", err);
        if (!annule) setEchec(true);
      }
    })();

    return () => {
      annule = true;
      if (carte) carte.remove();
      carteRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boutiques, depart, estPliee]);

  useEffect(() => {
    if (!estPliee && carteRef.current) {
      setTimeout(() => {
        carteRef.current?.invalidateSize();
      }, 250);
    }
  }, [modeCompact, estPliee]);

  if (boutiques.length === 0 || echec) return null;

  return (
    <div className="mb-4 rounded-2xl sm:rounded-3xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm transition-all duration-300">
      
      {/* 1. BARRE DE CONTRÔLE SUPÉRIEURE AVEC FLÈCHE ET BOUTONS VISIBLES */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 sm:px-4 py-2.5 bg-gradient-to-r from-gray-50 via-slate-50 to-gray-100 dark:from-gray-800/90 dark:to-gray-900/90 border-b border-gray-200 dark:border-gray-800 select-none">
        
        {/* Titre avec indicateur de position */}
        <div
          onClick={() => setEstPliee(!estPliee)}
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition"
          title={estPliee ? "Cliquez pour déplier la carte" : "Cliquez pour plier la carte"}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-gray-800 dark:text-gray-100">
            <span>Carte des boutiques</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-[#1877F2] dark:text-blue-400 text-[11px] font-bold">
              {boutiques.length}
            </span>
          </div>
        </div>

        {/* Boutons d'Action : 1. Gagner de l'espace (Compact) | 2. Flèche Plier/Déplier */}
        <div className="flex items-center gap-2 ml-auto">
          
          {/* BOUTON 1 : GAGNER DE L'ESPACE (Mode Compact) */}
          {!estPliee && (
            <button
              type="button"
              onClick={() => setModeCompact(!modeCompact)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs border active:scale-95 ${
                modeCompact
                  ? "bg-[#1877F2] text-white border-[#1877F2] ring-2 ring-blue-400/30"
                  : "bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600"
              }`}
              title={modeCompact ? "Agrandir la carte à la taille normale" : "Réduire la hauteur pour gagner de l'espace à l'écran"}
            >
              <svg
                className={`w-3.5 h-3.5 ${modeCompact ? "text-white" : "text-[#1877F2]"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {modeCompact ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 4v4H5m0 0l4-4M15 4v4h4m0 0l-4-4M9 20v-4H5m0 0l4 4M15 20v-4h4m0 0l-4 4" />
                )}
              </svg>
              <span className="font-extrabold">
                {modeCompact ? "Agrandir" : "Gagner de l'espace"}
              </span>
            </button>
          )}

          {/* BOUTON 2 : FLÈCHE POUR PLIER / DÉPLIER LA CARTE */}
          <button
            type="button"
            onClick={() => setEstPliee(!estPliee)}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs border active:scale-95 ${
              estPliee
                ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                : "bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600"
            }`}
            title={estPliee ? "Déplier et afficher la carte" : "Plier et masquer la carte pour voir directement les articles"}
          >
            {/* Flèche SVG très nette */}
            <svg
              className={`w-4 h-4 transition-transform duration-300 ${
                estPliee ? "rotate-180 text-white" : "rotate-0 text-gray-600 dark:text-gray-300"
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
            </svg>
            <span>{estPliee ? "Déplier la carte" : "Plier la carte"}</span>
          </button>
        </div>
      </div>

      {/* 2. CONTENU VISUEL DE LA CARTE (SI NON PLIÉE) */}
      {!estPliee ? (
        <div className="animate-in fade-in duration-200 relative group">
          
          {/* Boutons flottants d'accès rapide directement sur la carte */}
          <div className="absolute top-2.5 right-2.5 z-[400] flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              onClick={() => setModeCompact(!modeCompact)}
              className="px-2.5 py-1 rounded-lg bg-white/90 hover:bg-white text-gray-800 text-[10px] font-black shadow-md backdrop-blur-xs border border-gray-200 flex items-center gap-1 cursor-pointer transition active:scale-95"
              title={modeCompact ? "Agrandir" : "Réduire"}
            >
              <span>{modeCompact ? "🔍 Agrandir" : "🤏 Compact"}</span>
            </button>
            <button
              type="button"
              onClick={() => setEstPliee(true)}
              className="w-7 h-7 rounded-lg bg-white/90 hover:bg-white text-gray-800 shadow-md backdrop-blur-xs border border-gray-200 flex items-center justify-center cursor-pointer transition active:scale-95"
              title="Plier la carte"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>

          <div
            ref={conteneur}
            className={`w-full ${modeCompact ? "h-[135px] sm:h-[155px]" : "h-[220px] sm:h-[300px]"} z-0 transition-all duration-300`}
            style={{ background: "#e5e7eb" }}
            aria-label="Carte des boutiques proches"
          />
          
          <div className="px-3.5 sm:px-4 py-1.5 text-[11px] text-gray-500 dark:text-gray-400 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40">
            <span>
              {boutiques.length} boutique{boutiques.length > 1 ? "s" : ""} dans le rayon choisi. Touchez un marqueur pour voir ses articles.
            </span>
            {modeCompact && (
              <span className="text-blue-600 dark:text-blue-400 font-bold text-[10px]">
                ✓ Mode gain d&apos;espace actif
              </span>
            )}
          </div>
        </div>
      ) : (
        /* Message d'état quand la carte est pliée */
        <div
          onClick={() => setEstPliee(false)}
          className="px-4 py-3 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/50 dark:hover:bg-gray-800 text-xs text-gray-600 dark:text-gray-300 flex items-center justify-between cursor-pointer transition"
        >
          <div className="flex items-center gap-2 font-medium">
            <span className="text-[#1877F2] font-bold">🗺️ Carte repliée</span>
            <span>· Cliquez sur « Déplier » ou ici pour visualiser les {boutiques.length} boutiques</span>
          </div>
          <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-xs flex items-center gap-1">
            <span>Déplier</span>
            <svg className="w-3.5 h-3.5 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
            </svg>
          </span>
        </div>
      )}
    </div>
  );
}
