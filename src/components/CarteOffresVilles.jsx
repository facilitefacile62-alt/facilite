"use client";

// Carte « Autour de moi » de Facilité : une pastille à compteur par ville où des
// entreprises recrutent (voir src/lib/offresParVille.js). Mêmes choix que les
// autres cartes du site (CarteBoutiques) : Leaflet importé dynamiquement, tuiles
// OpenStreetMap, aucun marqueur PNG par défaut (bloqué par la CSP) — des divIcon
// et des cercles vectoriels uniquement ; molette désactivée tant que la carte
// n'a pas le focus, la page se fait défiler.
import { useEffect, useRef } from "react";

const BLEU = "#2563EB";
const ORANGE = "#F59E0B";

function detruire(carte) {
  if (!carte) return;
  try {
    carte.stop();
    carte._animatingZoom = false;
    carte.remove();
  } catch (err) {
    console.warn("Destruction de la carte Leaflet ignorée :", err?.message);
  }
}

export default function CarteOffresVilles({ groupes, selection, onSelect, position }) {
  const conteneur = useRef(null);
  const carteRef = useRef(null);
  const leafletRef = useRef(null);
  const couchesRef = useRef(null);
  const dejaAjustee = useRef(false);

  // Création de la carte (une seule fois).
  useEffect(() => {
    let annule = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (annule || !conteneur.current || carteRef.current) return;
      leafletRef.current = L;
      const carte = L.map(conteneur.current, { zoomControl: true, scrollWheelZoom: false, attributionControl: true }).setView([14.5, -15.5], 7);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(carte);
      couchesRef.current = L.layerGroup().addTo(carte);
      carteRef.current = carte;
      carte.on("focus", () => carte.scrollWheelZoom.enable());
      carte.on("blur", () => carte.scrollWheelZoom.disable());
      // Force un premier rendu des pastilles une fois la carte prête.
      carte.fire("facilite:prete");
    })();
    return () => {
      annule = true;
      detruire(carteRef.current);
      carteRef.current = null;
      couchesRef.current = null;
      dejaAjustee.current = false;
    };
  }, []);

  // Pastilles : redessinées quand les données ou la sélection changent.
  useEffect(() => {
    const dessiner = () => {
      const L = leafletRef.current;
      const carte = carteRef.current;
      const couches = couchesRef.current;
      if (!L || !carte || !couches) return;
      couches.clearLayers();
      const points = [];
      for (const g of groupes) {
        const n = g.offres.length;
        const taille = n >= 50 ? 58 : n >= 10 ? 50 : 42;
        const actif = selection === g.ville;
        const couleur = actif ? ORANGE : BLEU;
        const icone = L.divIcon({
          className: "bulle-offres-ville",
          html: `<div style="width:${taille}px;height:${taille}px;border-radius:9999px;background:${couleur};color:#fff;border:3px solid #fff;box-shadow:0 0 0 6px ${couleur}33,0 6px 16px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font:800 ${taille > 45 ? 18 : 16}px system-ui,sans-serif;cursor:pointer">${n}</div>`,
          iconSize: [taille, taille],
          iconAnchor: [taille / 2, taille / 2],
        });
        const marqueur = L.marker([g.lat, g.lng], { icon: icone, keyboard: false, title: `${g.ville} : ${n} offre${n > 1 ? "s" : ""}` }).addTo(couches);
        marqueur.bindTooltip(g.ville, { permanent: true, direction: "bottom", offset: [0, taille / 2 - 4] });
        marqueur.on("click", () => onSelect(g.ville));
        points.push([g.lat, g.lng]);
      }
      if (position) {
        L.circleMarker([position.lat, position.lng], { radius: 8, color: "#fff", weight: 3, fillColor: "#10B981", fillOpacity: 1, interactive: false })
          .bindTooltip("Vous êtes ici", { permanent: true, direction: "right", offset: [10, 0] })
          .addTo(couches);
      }
      if (!dejaAjustee.current && points.length > 0) {
        dejaAjustee.current = true;
        if (points.length === 1) carte.setView(points[0], 10);
        else carte.fitBounds(points, { padding: [40, 40], maxZoom: 9 });
      }
    };
    dessiner();
    const carte = carteRef.current;
    if (!carte) {
      // La carte peut ne pas être encore prête : on réessaie dès qu'elle l'est.
      const t = setInterval(() => {
        if (carteRef.current && leafletRef.current) {
          clearInterval(t);
          dessiner();
        }
      }, 150);
      return () => clearInterval(t);
    }
    return undefined;
  }, [groupes, selection, onSelect, position]);

  return <div ref={conteneur} className="w-full h-full rounded-2xl z-0" role="region" aria-label="Carte des villes où des entreprises recrutent" />;
}
