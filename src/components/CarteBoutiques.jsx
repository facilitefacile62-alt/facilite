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

  // Regroupement par boutique : la carte montre des lieux, la liste montre
  // des articles.
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
          // Mention exigée par les conditions d'usage des tuiles OpenStreetMap.
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

          // Cliquer un point fait défiler jusqu'à la boutique dans la liste :
          // la carte situe, la liste détaille — l'une renvoie à l'autre.
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

        // La carte est créée dans un conteneur qui peut encore s'animer : sans
        // cette invalidation, Leaflet mesure une hauteur nulle et ne charge
        // qu'une bande de tuiles.
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
  }, [boutiques, depart]);

  if (boutiques.length === 0 || echec) return null;

  return (
    <div className="mb-4 rounded-3xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div
        ref={conteneur}
        className="w-full h-[220px] sm:h-[280px] z-0"
        style={{ background: "#e5e7eb" }}
        aria-label="Carte des boutiques proches"
      />
      <p className="px-4 py-2 text-[11px] text-gray-500 dark:text-gray-400">
        {boutiques.length} boutique{boutiques.length > 1 ? "s" : ""} dans le rayon choisi. Touchez un
        point pour voir ses articles.
      </p>
    </div>
  );
}
