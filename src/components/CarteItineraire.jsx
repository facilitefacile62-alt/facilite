"use client";

// Carte d'itinéraire affichée DANS le fil de conversation.
//
// Jusqu'ici, chercher_itineraire produisait une réponse en texte : « prenez le
// BRT, arrêt Préfecture de Guédiawaye, à 2,5 km ». Exact, mais inutilisable
// pour quelqu'un qui ne connaît pas le quartier — 2,5 km dans quelle
// direction ? Le référentiel contient les coordonnées de chaque arrêt ; les
// dessiner coûte une carte et répond à la question réellement posée.
//
// Choix techniques, et pourquoi :
//  * Leaflet importé dynamiquement : il touche `window` dès l'évaluation du
//    module et casserait le rendu serveur.
//  * Cercles vectoriels plutôt que les marqueurs par défaut : ces derniers
//    chargent des PNG par une URL calculée à l'exécution, que la CSP bloque
//    silencieusement — on obtient une carte sans le moindre point, sans
//    erreur visible. Un cercle est du SVG, il ne dépend d'aucun fichier.
//  * Molette désactivée : la carte est au milieu d'une conversation qu'on
//    fait défiler. Capturer la molette bloquerait la lecture du fil.
import { useEffect, useRef, useState } from "react";

// Une couleur par mode, reprise sous la carte dans la légende : c'est ce qui
// permet de relier un tracé à sa ligne sans cliquer.
const COULEURS = {
  brt: "#2563eb",
  ter: "#0f766e",
  tata: "#b45309",
  car_rapide: "#c2410c",
  vtc: "#7c3aed",
};
const ETIQUETTES = {
  brt: "BRT",
  ter: "TER",
  tata: "Tata",
  car_rapide: "Car rapide",
  vtc: "VTC",
};
const couleurDe = (mode) => COULEURS[mode] || "#334155";

function distanceLisible(km) {
  if (km == null || !Number.isFinite(Number(km))) return null;
  const v = Number(km);
  // Sous le kilomètre, « 400 m » se comprend mieux que « 0,4 km ».
  if (v < 1) return `${Math.round(v * 1000)} m à pied`;
  return `${v.toString().replace(".", ",")} km à pied`;
}

export default function CarteItineraire({ payload }) {
  const conteneur = useRef(null);
  const carteRef = useRef(null);
  const [echec, setEchec] = useState(false);

  const lignes = Array.isArray(payload?.lignes) ? payload.lignes : [];
  const depart = payload?.depart;

  useEffect(() => {
    let annule = false;
    let carte = null;

    (async () => {
      if (!conteneur.current || lignes.length === 0) return;
      try {
        const L = (await import("leaflet")).default;
        await import("leaflet/dist/leaflet.css");
        // Le composant a pu être démonté pendant le chargement du module.
        if (annule || !conteneur.current) return;

        carte = L.map(conteneur.current, {
          scrollWheelZoom: false,
          attributionControl: true,
        });
        carteRef.current = carte;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          // Mention exigée par les conditions d'usage des tuiles OpenStreetMap.
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(carte);

        const points = [];

        for (const l of lignes) {
          const couleur = couleurDe(l?.mode);
          const arrets = Array.isArray(l?.arrets) ? l.arrets : [];
          const trace = arrets.map((a) => [a.lat, a.lng]);

          if (trace.length > 1) {
            L.polyline(trace, { color: couleur, weight: 4, opacity: 0.75 }).addTo(carte);
          }
          for (const a of arrets) {
            L.circleMarker([a.lat, a.lng], {
              radius: 4,
              color: couleur,
              weight: 2,
              fillColor: "#ffffff",
              fillOpacity: 1,
            })
              .addTo(carte)
              .bindTooltip(a.nom || "Arrêt");
          }
          points.push(...trace);

          // L'arrêt où monter : plus gros et plein, c'est l'information utile.
          if (Number.isFinite(Number(l?.arret?.lat)) && Number.isFinite(Number(l?.arret?.lng))) {
            L.circleMarker([l.arret.lat, l.arret.lng], {
              radius: 8,
              color: couleur,
              weight: 3,
              fillColor: couleur,
              fillOpacity: 0.9,
            })
              .addTo(carte)
              .bindTooltip(`Montez ici : ${l.arret_de_depart || "arrêt le plus proche"}`, {
                permanent: false,
              });
            points.push([l.arret.lat, l.arret.lng]);
          }
        }

        if (Number.isFinite(Number(depart?.lat)) && Number.isFinite(Number(depart?.lng))) {
          L.circleMarker([depart.lat, depart.lng], {
            radius: 7,
            color: "#dc2626",
            weight: 3,
            fillColor: "#dc2626",
            fillOpacity: 0.35,
          })
            .addTo(carte)
            .bindTooltip("Vous êtes ici");
          points.push([depart.lat, depart.lng]);
        }

        if (points.length > 0) {
          carte.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 15 });
        } else {
          carte.setView([14.716677, -17.467686], 11); // Dakar
        }

        // La carte est créée dans une bulle qui peut encore s'animer : sans
        // cette invalidation, Leaflet mesure une hauteur nulle et ne charge
        // qu'une bande de tuiles.
        setTimeout(() => {
          if (!annule && carteRef.current) carteRef.current.invalidateSize();
        }, 200);
      } catch (err) {
        console.error("Carte d'itinéraire indisponible :", err);
        if (!annule) setEchec(true);
      }
    })();

    return () => {
      annule = true;
      if (carte) carte.remove();
      carteRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  if (lignes.length === 0) return null;

  return (
    <div className="mt-2 mb-1 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 bg-white dark:bg-[#111B21]">
      {!echec && (
        <div
          ref={conteneur}
          className="w-full h-[190px] sm:h-[220px] z-0"
          style={{ background: "#e5e7eb" }}
          aria-label={`Carte de l'itinéraire vers ${payload?.destination || "votre destination"}`}
        />
      )}

      <ul className="divide-y divide-black/5 dark:divide-white/5">
        {lignes.map((l, i) => {
          const couleur = couleurDe(l?.mode);
          const dist = distanceLisible(l?.distance_a_pied_km);
          return (
            <li key={`${l?.ligne || l?.mode}-${i}`} className="px-3 py-2 flex items-start gap-2.5">
              <span
                className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                style={{ background: couleur }}
              >
                {ETIQUETTES[l?.mode] || String(l?.mode || "").toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {l?.ligne || "Ligne"}
                </p>
                <p className="text-[11px] text-gray-600 dark:text-gray-400">
                  {l?.arret_de_depart ? `Arrêt ${l.arret_de_depart}` : "Arrêt le plus proche"}
                  {dist ? ` · ${dist}` : ""}
                </p>
              </div>
              {l?.tarif_xof && (
                <span className="shrink-0 text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                  {l.tarif_xof} FCFA
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
