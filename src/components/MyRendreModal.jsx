"use client";

// « M'y rendre » depuis la fiche d'une boutique Marketplace.
//
// L'itinéraire routier est calculé par /api/marketplace/itineraire, réservé aux
// comptes connectés. La position de l'utilisateur n'est transmise qu'à ce calcul
// et n'est pas conservée (politique de confidentialité, sections 2 et 8). Si le
// calcul échoue, on affiche la distance à vol d'oiseau, calculée dans le navigateur.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";

const RAYON_TERRE_KM = 6371;

function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * RAYON_TERRE_KM * Math.asin(Math.sqrt(h));
}

function distanceLisible(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toString().replace(".", ",").slice(0, 5)} km`;
}

const coordonneeValide = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));

export default function MyRendreModal({ boutique, onFermer }) {
  const conteneur = useRef(null);
  const [position, setPosition] = useState(null);
  const [refus, setRefus] = useState(false);
  const [session, setSession] = useState(undefined); // undefined = pas encore vérifiée
  const [itineraire, setItineraire] = useState(null); // { distance_km, duree_min, points } ou null
  const [distanceVolOiseau, setDistanceVolOiseau] = useState(null);
  const [itineraireIndisponible, setItineraireIndisponible] = useState(false);

  const coordonneesOk = coordonneeValide(boutique?.lat) && coordonneeValide(boutique?.lng);
  const destLat = coordonneesOk ? Number(boutique.lat) : null;
  const destLng = coordonneesOk ? Number(boutique.lng) : null;
  const pasDeGeolocalisation = typeof navigator === "undefined" || !navigator.geolocation;

  useEffect(() => {
    let annule = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!annule) setSession(data?.session ?? null);
    });
    return () => {
      annule = true;
    };
  }, []);

  useEffect(() => {
    if (session === undefined || !session || !coordonneesOk || pasDeGeolocalisation) return undefined;
    const destination = [destLat, destLng];
    let annule = false;
    let carte = null;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (annule) return;
        const moi = [pos.coords.latitude, pos.coords.longitude];
        setPosition(moi);
        const volOiseau = distanceKm(moi, destination);
        setDistanceVolOiseau(volOiseau);

        // Itinéraire routier : la position ne sert qu'à ce calcul.
        let trace = [moi, destination];
        try {
          const reponse = await fetch("/api/marketplace/itineraire", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              depart: { lat: moi[0], lng: moi[1] },
              arrivee: { lat: destination[0], lng: destination[1] },
              profil: "pieton",
            }),
          });
          if (!reponse.ok) throw new Error("itineraire_indisponible");
          const donnees = await reponse.json();
          if (!annule && Array.isArray(donnees.points) && donnees.points.length > 1) {
            setItineraire(donnees);
            trace = donnees.points;
          } else {
            setItineraireIndisponible(true);
          }
        } catch {
          if (!annule) setItineraireIndisponible(true);
        }
        if (annule) return;

        const L = (await import("leaflet")).default;
        if (annule || !conteneur.current) return;

        carte = L.map(conteneur.current, { zoomControl: true, scrollWheelZoom: false });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
          maxZoom: 19,
        }).addTo(carte);

        L.polyline(trace, { color: "#2563eb", weight: 5 }).addTo(carte);
        // Cercles vectoriels plutôt que marqueurs par défaut : les PNG par défaut
        // sont bloqués par la CSP du site sans erreur visible.
        L.circleMarker(moi, { radius: 8, color: "#ffffff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }).addTo(carte);
        L.circleMarker(destination, { radius: 10, color: "#ffffff", weight: 3, fillColor: "#10b981", fillOpacity: 1 }).addTo(carte);
        carte.fitBounds(L.latLngBounds(trace), { padding: [40, 40] });
      },
      () => {
        if (!annule) setRefus(true);
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    );

    return () => {
      annule = true;
      if (carte) carte.remove();
    };
  }, [session, coordonneesOk, pasDeGeolocalisation, destLat, destLng]);

  const etat =
    session === undefined
      ? "chargement"
      : !session
        ? "connexion"
        : !coordonneesOk
          ? "indisponible"
          : pasDeGeolocalisation || refus
            ? "refuse"
            : position
              ? "ok"
              : "chargement";

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onFermer}>
      <div
        className="w-full sm:max-w-lg bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-zinc-800">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wider text-blue-600">M&apos;y rendre</p>
            <p className="text-sm font-black text-zinc-900 dark:text-white truncate">{boutique?.nom || "Boutique"}</p>
          </div>
          <button
            type="button"
            onClick={onFermer}
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 flex items-center justify-center"
            aria-label="Fermer"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="px-5 py-3 text-sm font-bold text-zinc-800 dark:text-zinc-200">
          {etat === "chargement" && "Localisation en cours…"}
          {etat === "connexion" && "Connecte-toi pour voir l'itinéraire jusqu'à cette boutique."}
          {etat === "ok" && itineraire && (
            <>
              À pied : <span className="text-blue-600">{distanceLisible(itineraire.distance_km)}</span>
              {itineraire.duree_min ? <span className="text-zinc-500"> · environ {itineraire.duree_min} min</span> : null}
            </>
          )}
          {etat === "ok" && !itineraire && distanceVolOiseau !== null && (
            <>
              À vol d&apos;oiseau : <span className="text-blue-600">{distanceLisible(distanceVolOiseau)}</span>
              {itineraireIndisponible && <span className="block text-xs text-zinc-500 mt-1">Itinéraire routier indisponible pour le moment.</span>}
            </>
          )}
          {etat === "refuse" && "Autorise la localisation de ton navigateur pour voir la distance."}
          {etat === "indisponible" && "Cette boutique n'a pas encore de position enregistrée."}
        </div>

        <div
          ref={conteneur}
          className="w-full h-72 bg-gray-100 dark:bg-zinc-800"
          style={{ display: etat === "ok" ? "block" : "none" }}
        />
      </div>
    </div>,
    document.body
  );
}
