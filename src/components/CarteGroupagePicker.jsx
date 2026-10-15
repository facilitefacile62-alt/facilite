"use client";

// Carte du formulaire « Annoncer un groupage » : le livreur y pose son départ et
// sa destination (clic sur la carte quand un des deux est en cours de choix) et y
// voit son trajet. Même contraintes que les autres cartes du site : Leaflet
// importé dynamiquement, aucun marqueur PNG par défaut (bloqué par la CSP) —
// des divIcon —, molette désactivée tant que la carte n'a pas été touchée.
import { useEffect, useRef } from "react";

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

const pastille = (couleur, lettre) =>
  `<div style="width:30px;height:30px;border-radius:9999px;background:${couleur};color:#fff;border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font:900 11px system-ui,sans-serif">${lettre}</div>`;

export default function CarteGroupagePicker({ depart, destination, trace, mode, onPick, point = null, hauteur = 260 }) {
  const conteneur = useRef(null);
  const carteRef = useRef(null);
  const leafletRef = useRef(null);
  const couchesRef = useRef(null);
  const modeRef = useRef(mode);
  const pickRef = useRef(onPick);

  useEffect(() => {
    modeRef.current = mode;
    pickRef.current = onPick;
  });

  useEffect(() => {
    let annule = false;
    let observateur = null;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (annule || !conteneur.current || carteRef.current) return;
      leafletRef.current = L;
      const carte = L.map(conteneur.current, { scrollWheelZoom: false }).setView([14.72, -17.3], 10);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(carte);
      couchesRef.current = L.layerGroup().addTo(carte);
      carteRef.current = carte;
      carte.on("click", (e) => {
        carte.scrollWheelZoom.enable();
        if (modeRef.current) pickRef.current?.(e.latlng.lat, e.latlng.lng);
      });
      observateur = new ResizeObserver(() => carte.invalidateSize());
      observateur.observe(conteneur.current);
      // Prévient le dessin des repères que la carte est prête.
      window.dispatchEvent(new Event("facilite:carte-groupage-prete"));
    })();
    return () => {
      annule = true;
      observateur?.disconnect();
      detruire(carteRef.current);
      carteRef.current = null;
      couchesRef.current = null;
    };
  }, []);

  // Dessin : repères de départ/destination et trajet, recalé sur ce qui existe.
  useEffect(() => {
    const dessiner = () => {
      const L = leafletRef.current;
      const carte = carteRef.current;
      const couches = couchesRef.current;
      if (!L || !carte || !couches) return false;
      couches.clearLayers();
      const points = [];
      if (trace && trace.length > 1) {
        L.polyline(trace, { color: "#2563EB", weight: 5, opacity: 0.85 }).addTo(couches);
        points.push(...trace);
      } else if (depart && destination) {
        L.polyline([[depart.lat, depart.lng], [destination.lat, destination.lng]], { color: "#2563EB", weight: 4, dashArray: "6 8" }).addTo(couches);
      }
      if (depart) {
        L.marker([depart.lat, depart.lng], { icon: L.divIcon({ className: "", html: pastille("#10B981", "A"), iconSize: [30, 30], iconAnchor: [15, 15] }), keyboard: false, title: "Départ" }).addTo(couches);
        points.push([depart.lat, depart.lng]);
      }
      if (destination) {
        L.marker([destination.lat, destination.lng], { icon: L.divIcon({ className: "", html: pastille("#EF4444", "B"), iconSize: [30, 30], iconAnchor: [15, 15] }), keyboard: false, title: "Destination" }).addTo(couches);
        points.push([destination.lat, destination.lng]);
      }
      if (point) {
        L.marker([point.lat, point.lng], { icon: L.divIcon({ className: "", html: pastille("#2563EB", "Toi"), iconSize: [30, 30], iconAnchor: [15, 15] }), keyboard: false, title: "Ton lieu de livraison" }).addTo(couches);
        points.push([point.lat, point.lng]);
      }
      if (points.length === 1) carte.setView(points[0], Math.max(carte.getZoom(), 12));
      else if (points.length > 1) carte.fitBounds(points, { padding: [30, 30], maxZoom: 14 });
      return true;
    };
    if (dessiner()) return undefined;
    // La carte peut ne pas être encore prête : on réessaie dès qu'elle l'est.
    const surPrete = () => dessiner();
    window.addEventListener("facilite:carte-groupage-prete", surPrete);
    return () => window.removeEventListener("facilite:carte-groupage-prete", surPrete);
  }, [depart, destination, trace, point]);

  return (
    <div className="relative">
      <div ref={conteneur} style={{ height: hauteur }} className="w-full rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 z-0" role="region" aria-label="Carte du groupage" />
      {mode ? (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[400] px-3 py-1.5 rounded-full bg-black/75 text-white text-[11px] font-black pointer-events-none">
          Touche la carte pour placer {mode === "depart" ? "le DÉPART (A)" : mode === "point" ? "TON LIEU DE LIVRAISON" : "la DESTINATION (B)"}
        </div>
      ) : null}
    </div>
  );
}
