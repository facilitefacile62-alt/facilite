"use client";

// Écran d'exploration ludique du Marketplace — un globe 3D avec les
// boutiques actives comme points lumineux, inspiré de la structure des
// cartes sociales façon "Snap Map" (globe sombre, points groupés par zone
// dense) mais sans rien reprendre de leur identité visuelle propre (pas
// d'avatars, pas de charte Snapchat) : juste l'idée d'un globe qui donne
// envie d'explorer avant de basculer sur l'outil concret.
//
// Volontairement un COMPLÉMENT, pas un remplacement de la carte réelle
// (CarteBoutiques.jsx, Leaflet/OpenStreetMap) : un globe ne montre ni rues
// ni quartiers exploitables pour s'y rendre — seule la vraie carte permet
// de trouver un chemin. Le bouton "Voir sur la carte" ferme ce panneau et
// relance la recherche de proximité réelle (onVoirCarte).
//
// cobe (~5 Ko, zéro dépendance) plutôt que Three.js/react-globe.gl : cet
// écran est purement décoratif, inutile de charger un moteur 3D complet
// pour quelques points lumineux qui tournent.
import { useEffect, useRef } from "react";
import createGlobe from "cobe";

const BLEU_FACILITE = [0.094, 0.467, 0.945]; // #1877F2 normalisé 0..1
const EMERAUDE = [0.063, 0.725, 0.506]; // #10E688 normalisé 0..1

export default function GlobeExplorateurBoutiques({ boutiques = [], onFermer, onVoirCarte }) {
  const canvasRef = useRef(null);
  const phiRef = useRef(4.2); // cadré sur l'Afrique de l'Ouest au démarrage, pas l'Atlantique vide

  const marqueurs = boutiques
    .filter((b) => Number.isFinite(b.lat) && Number.isFinite(b.lng) && (b.lat !== 0 || b.lng !== 0))
    .map((b) => ({
      location: [b.lat, b.lng],
      size: 0.045,
      color: BLEU_FACILITE,
    }));

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    let phi = phiRef.current;
    let largeur = canvasRef.current.offsetWidth;

    const gerer = () => {
      if (canvasRef.current) largeur = canvasRef.current.offsetWidth;
    };
    window.addEventListener("resize", gerer);

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      width: largeur * 2,
      height: largeur * 2,
      phi,
      theta: 0.28,
      dark: 1,
      diffuse: 1.3,
      mapSamples: 16000,
      mapBrightness: 4,
      baseColor: [0.11, 0.14, 0.2],
      markerColor: BLEU_FACILITE,
      glowColor: EMERAUDE,
      scale: 1.05,
      markers: marqueurs,
      onRender: (state) => {
        phi += 0.0028;
        phiRef.current = phi;
        state.phi = phi;
        state.width = largeur * 2;
        state.height = largeur * 2;
      },
    });

    return () => {
      globe.destroy();
      window.removeEventListener("resize", gerer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boutiques.length]);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center bg-[#05070c] animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label="Explorer les boutiques sur le globe"
    >
      {/* Ciel étoilé léger, en CSS pur — pas besoin d'un second calque WebGL */}
      <div
        className="absolute inset-0 opacity-70 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 20% 30%, #fff 100%, transparent), radial-gradient(1px 1px at 65% 12%, #fff 100%, transparent), radial-gradient(1.5px 1.5px at 85% 45%, #fff 100%, transparent), radial-gradient(1px 1px at 40% 70%, #fff 100%, transparent), radial-gradient(1px 1px at 92% 80%, #fff 100%, transparent), radial-gradient(1.5px 1.5px at 10% 85%, #fff 100%, transparent), radial-gradient(1px 1px at 55% 92%, #fff 100%, transparent)",
          backgroundSize: "100% 100%",
        }}
      />

      <div className="relative z-10 w-full flex items-center justify-between px-5 pt-5 sm:pt-6">
        <div>
          <p className="text-white font-black text-base flex items-center gap-2">
            <span aria-hidden="true">🌍</span> Explorer les boutiques
          </p>
          <p className="text-white/50 text-xs font-medium mt-0.5">
            {marqueurs.length} boutique{marqueurs.length > 1 ? "s" : ""} active
            {marqueurs.length > 1 ? "s" : ""} sur Facilité
          </p>
        </div>
        <button
          type="button"
          onClick={onFermer}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition"
          aria-label="Fermer"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div className="relative z-10 flex-1 w-full flex items-center justify-center px-6 min-h-0">
        <div className="w-full max-w-[440px] aspect-square">
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height: "100%", cursor: "grab" }}
            aria-label="Globe montrant les boutiques Facilité"
          />
        </div>
      </div>

      <div className="relative z-10 w-full px-5 pb-6 sm:pb-8 flex flex-col items-center gap-3">
        {boutiques.length === 0 && (
          <p className="text-white/60 text-xs font-medium text-center max-w-xs">
            Aucune boutique géolocalisée pour l&apos;instant — reviens quand des vendeurs auront enregistré leur
            position.
          </p>
        )}
        <button
          type="button"
          onClick={onVoirCarte}
          className="w-full max-w-sm py-3.5 rounded-2xl bg-[#1877F2] hover:bg-blue-600 text-white text-sm font-black shadow-lg shadow-blue-600/30 cursor-pointer transition flex items-center justify-center gap-2"
        >
          <i className="fa-solid fa-location-crosshairs"></i>
          Voir près de chez moi sur la carte
        </button>
      </div>
    </div>
  );
}
