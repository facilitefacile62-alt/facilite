"use client";

// Carte des établissements ouverts (Point Wave, pharmacie, clinique).
//
// Même patron que CarteBoutiques, pour la même raison : Leaflet importé
// dynamiquement (il touche `window` dès l'évaluation du module), des cercles
// vectoriels plutôt que les marqueurs par défaut (qui chargent des PNG par une
// URL calculée à l'exécution — bloqués par la CSP, sans erreur visible, donc
// une carte vide sans explication), et la molette désactivée puisque la carte
// est au milieu d'une page qu'on fait défiler.
import { useEffect, useMemo, useRef, useState } from "react";

const COULEURS = {
  wave_point: "#f97316",
  pharmacy: "#16a34a",
  clinic: "#2563eb",
};
const COULEUR_FERME = "#9ca3af";

function point(lat, lng) {
  const a = lat === null || lat === undefined || lat === "" ? null : Number(lat);
  const b = lng === null || lng === undefined || lng === "" ? null : Number(lng);
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  return [a, b];
}

export default function CarteEtablissements({ etablissements, depart }) {
  const conteneur = useRef(null);
  const carteRef = useRef(null);
  const [echec, setEchec] = useState(false);
  
  const [estPliee, setEstPliee] = useState(false);
  const [modeCompact, setModeCompact] = useState(false);

  const points = useMemo(
    () => (etablissements || []).map((e) => ({ ...e, position: point(e.latitude, e.longitude) })).filter((e) => e.position),
    [etablissements]
  );

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
      if (!conteneur.current || points.length === 0) return;
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

        const bornes = [];

        for (const e of points) {
          const couleur = e.is_open ? COULEURS[e.activity_type] || COULEUR_FERME : COULEUR_FERME;
          L.circleMarker(e.position, {
            radius: e.is_open ? 9 : 7,
            color: couleur,
            weight: 3,
            fillColor: couleur,
            fillOpacity: e.is_open ? 0.85 : 0.35,
          })
            .addTo(carte)
            .bindTooltip(
              [`<strong>${e.nom || "Établissement"}</strong>`, e.is_open ? "Ouvert" : "Fermé"].join("<br>")
            );
          bornes.push(e.position);
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
          bornes.push(ici);
        }

        carte.fitBounds(L.latLngBounds(bornes), { padding: [28, 28], maxZoom: 15 });

        setTimeout(() => {
          if (!annule && carteRef.current) carteRef.current.invalidateSize();
        }, 200);
      } catch (err) {
        console.error("Carte des établissements indisponible :", err);
        if (!annule) setEchec(true);
      }
    })();

    return () => {
      annule = true;
      if (carte) carte.remove();
      carteRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, depart, estPliee]);

  useEffect(() => {
    if (!estPliee && carteRef.current) {
      setTimeout(() => {
        carteRef.current?.invalidateSize();
      }, 250);
    }
  }, [modeCompact, estPliee]);

  if (points.length === 0 || echec) return null;

  return (
    <div className="mb-4 rounded-2xl sm:rounded-3xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm transition-all duration-300">
      {/* En-tête avec contrôles */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 sm:px-4 py-2 bg-gray-50/90 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-black text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
            <i className="fa-solid fa-map-location-dot text-[#1877F2]"></i>
            <span>Établissements ({points.length})</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {!estPliee && (
            <button
              type="button"
              onClick={() => setModeCompact(!modeCompact)}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs border ${
                modeCompact
                  ? "bg-[#1877F2] text-white border-[#1877F2]"
                  : "bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600"
              }`}
              title={modeCompact ? "Agrandir la carte" : "Réduire la hauteur pour gagner de l'espace"}
            >
              <i className={`fa-solid ${modeCompact ? "fa-up-right-and-down-left-from-center" : "fa-down-left-and-up-right-to-center"} text-[10px] ${modeCompact ? "text-white" : "text-[#1877F2]"}`}></i>
              <span className="hidden xs:inline sm:inline">
                {modeCompact ? "Agrandir" : "Gagner de l'espace"}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setEstPliee(!estPliee)}
            className="px-2.5 py-1 rounded-xl bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            title={estPliee ? "Déplier la carte" : "Plier la carte"}
          >
            <i className={`fa-solid ${estPliee ? "fa-chevron-down text-emerald-500" : "fa-chevron-up text-gray-500"} text-[10px]`}></i>
            <span>{estPliee ? "Déplier la carte" : "Plier la carte"}</span>
          </button>
        </div>
      </div>

      {!estPliee && (
        <div className="animate-in fade-in duration-200">
          <div
            ref={conteneur}
            className={`w-full ${modeCompact ? "h-[135px] sm:h-[150px]" : "h-[220px] sm:h-[280px]"} z-0 transition-all duration-300`}
            style={{ background: "#e5e7eb" }}
            aria-label="Carte des établissements proches"
          />
          <div className="px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
            <div className="flex items-center gap-3">
              <span><span className="inline-block w-2 h-2 rounded-full bg-[#f97316] mr-1"></span>Point Wave</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-[#16a34a] mr-1"></span>Pharmacie</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-[#2563eb] mr-1"></span>Clinique</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-gray-400 mr-1"></span>Fermé</span>
            </div>
            {modeCompact && (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                <i className="fa-solid fa-check mr-1"></i>Mode compact
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
