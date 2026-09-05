"use client";

// Écran d'exploration du Marketplace — une vraie carte (MapLibre GL +
// tuiles vectorielles OpenFreeMap) avec projection "globe" : dézoomée, on
// voit un globe 3D avec les boutiques comme points ; en zoomant, MapLibre
// bascule tout seul vers une carte Mercator détaillée (rues, noms de lieux)
// — exactement le comportement Snap Map / Google Earth demandé, géré
// nativement par la librairie, sans code de transition à écrire.
//
// Remplace l'ancien globe décoratif (cobe, ~5 Ko, aucune vraie carte) : ce
// composant-ci pèse ~257 Ko compressés en plus (maplibre-gl) — accepté
// explicitement par l'utilisateur malgré le coût en données mobiles, parce
// que c'est maintenant une VRAIE carte navigable, pas un élément décoratif.
// Chargé en dynamique (next/dynamic, voir MarketplaceClient.jsx) : ce poids
// n'est payé que par les personnes qui ouvrent réellement "Explorer".
//
// Volontairement distinct de CarteBoutiques.jsx (Leaflet, carte compacte
// intégrée à la liste de résultats "Autour de moi") : ce fichier-là est
// actuellement modifié par un autre chantier en cours (boutons plier/mode
// compact), on n'y touche pas ici pour éviter tout conflit. Les deux cartes
// répondent à des besoins différents — celle-ci est l'écran d'exploration
// plein écran, l'autre reste la vignette de résultats de recherche.
//
// Service de tuiles OpenFreeMap : gratuit, sans clé API, mais géré par un
// développeur indépendant, financé par dons, sans garantie de disponibilité
// (CGU "AS-IS"). Accepté comme risque connu pour l'instant.
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { positionActuelle } from "@/lib/marketplaceData";

const STYLE_OPENFREEMAP = "https://tiles.openfreemap.org/styles/liberty";
const COULEUR_BOUTIQUE = "#1877F2";
const COULEUR_MOI = "#dc2626";
const CENTRE_SENEGAL = [-14.4524, 14.4974];

function creerPastille(couleur, taille = 16) {
  const el = document.createElement("div");
  el.style.width = `${taille}px`;
  el.style.height = `${taille}px`;
  el.style.borderRadius = "50%";
  el.style.background = couleur;
  el.style.border = "2px solid white";
  el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.4)";
  return el;
}

export default function GlobeExplorateurBoutiques({ boutiques = [], onFermer }) {
  const conteneurRef = useRef(null);
  const carteRef = useRef(null);
  const [localisationEnCours, setLocalisationEnCours] = useState(false);
  const [erreurLocalisation, setErreurLocalisation] = useState("");

  const marqueurs = boutiques.filter(
    (b) => Number.isFinite(b.lat) && Number.isFinite(b.lng) && (b.lat !== 0 || b.lng !== 0)
  );

  useEffect(() => {
    if (!conteneurRef.current) return undefined;

    const carte = new maplibregl.Map({
      container: conteneurRef.current,
      style: STYLE_OPENFREEMAP,
      center: CENTRE_SENEGAL,
      zoom: 2,
      attributionControl: { compact: true },
    });
    carteRef.current = carte;

    carte.on("style.load", () => {
      carte.setProjection({ type: "globe" });
    });

    carte.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    for (const b of marqueurs) {
      const popup = new maplibregl.Popup({ offset: 14, closeButton: false }).setText(
        b.nom || "Boutique Facilité"
      );
      new maplibregl.Marker({ element: creerPastille(COULEUR_BOUTIQUE) })
        .setLngLat([b.lng, b.lat])
        .setPopup(popup)
        .addTo(carte);
    }

    return () => carte.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boutiques.length]);

  const allerAMaPosition = async () => {
    setErreurLocalisation("");
    setLocalisationEnCours(true);
    try {
      const pos = await positionActuelle();
      new maplibregl.Marker({ element: creerPastille(COULEUR_MOI, 14) })
        .setLngLat([pos.longitude, pos.latitude])
        .addTo(carteRef.current);
      carteRef.current?.flyTo({ center: [pos.longitude, pos.latitude], zoom: 14, speed: 1.1 });
    } catch (err) {
      setErreurLocalisation(err.message || "Localisation indisponible.");
    } finally {
      setLocalisationEnCours(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-[#0B0F17]"
      role="dialog"
      aria-modal="true"
      aria-label="Explorer les boutiques sur la carte"
    >
      <div className="relative z-10 w-full flex items-center justify-between px-5 pt-5 sm:pt-6 pb-3 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <div className="pointer-events-auto">
          <p className="text-white font-black text-base flex items-center gap-2 drop-shadow">
            <span aria-hidden="true">🌍</span> Explorer les boutiques
          </p>
          <p className="text-white/70 text-xs font-medium mt-0.5 drop-shadow">
            {marqueurs.length} boutique{marqueurs.length > 1 ? "s" : ""} active
            {marqueurs.length > 1 ? "s" : ""} · zoomez pour voir les rues
          </p>
        </div>
        <button
          type="button"
          onClick={onFermer}
          className="pointer-events-auto w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer transition backdrop-blur-xs"
          aria-label="Fermer"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div className="relative flex-1 min-h-0">
        <div ref={conteneurRef} className="absolute inset-0" />

        <button
          type="button"
          onClick={allerAMaPosition}
          disabled={localisationEnCours}
          className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 px-5 py-3.5 rounded-2xl bg-[#1877F2] hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-black shadow-lg shadow-blue-600/30 cursor-pointer transition flex items-center gap-2"
        >
          <i className={`fa-solid ${localisationEnCours ? "fa-spinner fa-spin" : "fa-location-crosshairs"}`}></i>
          {localisationEnCours ? "Localisation…" : "Aller à ma position"}
        </button>

        {erreurLocalisation && (
          <p className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 bg-red-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-lg max-w-[85%] text-center">
            {erreurLocalisation}
          </p>
        )}
      </div>
    </div>
  );
}
