"use client";

// Carte des établissements ouverts (Point Wave, pharmacie, clinique).
//
// Même patron que CarteBoutiques, pour la même raison : Leaflet importé
// dynamiquement (il touche `window` dès l'évaluation du module), des cercles
// vectoriels plutôt que les marqueurs par défaut (qui chargent des PNG par une
// URL calculée à l'exécution — bloqués par la CSP, sans erreur visible, donc
// une carte vide sans explication), et la molette désactivée puisque la carte
// est au milieu d'une page qu'on fait défiler.
//
// Une couleur par métier plutôt qu'un simple ouvert/fermé : la question posée
// par cet écran n'est pas seulement « qui est ouvert » mais « qui est ouvert,
// PARMI QUOI ». Un point gris (fermé) reste visible mais discret, pour que la
// carte dise aussi ce qui existe à proximité sans être disponible maintenant.
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

  const points = useMemo(
    () => (etablissements || []).map((e) => ({ ...e, position: point(e.latitude, e.longitude) })).filter((e) => e.position),
    [etablissements]
  );

  useEffect(() => {
    let annule = false;
    let carte = null;

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
  }, [points, depart]);

  if (points.length === 0 || echec) return null;

  return (
    <div className="mb-4 rounded-3xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div
        ref={conteneur}
        className="w-full h-[220px] sm:h-[280px] z-0"
        style={{ background: "#e5e7eb" }}
        aria-label="Carte des établissements proches"
      />
      <div className="px-4 py-2 flex items-center gap-3 text-[10px] font-bold text-gray-500 dark:text-gray-400">
        <span><span className="inline-block w-2 h-2 rounded-full bg-[#f97316] mr-1"></span>Point Wave</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-[#16a34a] mr-1"></span>Pharmacie</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-[#2563eb] mr-1"></span>Clinique</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-gray-400 mr-1"></span>Fermé</span>
      </div>
    </div>
  );
}
