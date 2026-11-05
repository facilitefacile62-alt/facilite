"use client";
// Carte 3D de Locaux (PROTOTYPE) — MapLibre GL JS, bâtiments en volume, un repère par boutique, bouton 2D/3D.
//
// Données : fond de carte OpenFreeMap (style « positron », sans clé, sans compte) ; bâtiments issus de l'Overture Maps (voir scripts/carte3d/extraire-batiments.py), fichier statique
// public/carte3d/batiments.geojson chargé SEULEMENT quand la 3D est active. Les boutiques sont chargées comme sur la carte 2D actuelle (mêmes fonctions publiques) : cette carte
// ne montre donc rien de plus que la carte actuelle, et aucune coordonnée n'est écrite dans le HTML de la page (rendu côté navigateur uniquement).
// Repli : appareil trop faible, WebGL absent, fond de carte injoignable ou carte trop lente => retour à la carte 2D actuelle (ou carte plate sans volumes).
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { ADRESSE_CARTE_2D, peutAfficher3D } from "@/lib/carte3d";
import { chargerLogosBoutiques, chargerTousLesArticles, echapperHtml } from "@/lib/marketplaceData";
import { htmlEpingle } from "@/lib/epingleCarte";
import { svgAvatarBoutique } from "@/lib/avatarBoutique";

const STYLE_FOND = "https://tiles.openfreemap.org/styles/positron";
const CENTRE_DEFAUT = [-17.384, 14.756]; // [lng, lat] : Pikine
const INCLINAISON_3D = 60;
const DELAI_CHARGEMENT_MS = 15000;
const ATTRIBUTION_BATIMENTS = "Bâtiments : © Overture Maps Foundation, OpenStreetMap contributors";

function construireBoutiques(articles, logos) {
  const vues = new Set();
  const liste = [];
  for (const a of articles || []) {
    const lat = Number(a.boutique_lat);
    const lng = Number(a.boutique_lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || vues.has(a.boutique_id)) continue;
    vues.add(a.boutique_id);
    liste.push({
      id: a.boutique_id,
      lat,
      lng,
      nom: a.boutique_nom || "Boutique",
      quartier: a.quartier || a.ville || "Sénégal",
      avatar_config: a.boutique_avatar_config || null,
      logo_url: logos?.get?.(a.boutique_id) || null,
      nbArticles: (articles || []).filter((r) => r.boutique_id === a.boutique_id).length,
    });
  }
  return liste;
}

function elementRepere(b) {
  const boite = document.createElement("div");
  boite.style.cssText = "width:140px;height:90px;cursor:pointer;";
  let contenu = null;
  try {
    contenu = b.logo_url
      ? `<img src="${echapperHtml(b.logo_url)}" alt="" style="width:100%;height:100%;object-fit:cover;" />`
      : b.avatar_config
      ? svgAvatarBoutique(b.avatar_config, 52)
      : null;
  } catch {
    contenu = null;
  }
  boite.innerHTML = htmlEpingle({ couleur: "#10B981", type: "produit", nom: echapperHtml(String(b.nom).slice(0, 18)), contenuHtml: contenu });
  boite.querySelector(".epingle-boite").style.pointerEvents = "auto";
  return boite;
}

export default function Carte3D() {
  const conteneurRef = useRef(null);
  const carteRef = useRef(null);
  const bibliothequeRef = useRef(null);
  const batimentsAjoutesRef = useRef(false);
  const [etat, setEtat] = useState("chargement"); // chargement | pret | repli
  const [raison, setRaison] = useState("");
  const [mode3D, setMode3D] = useState(true);
  const [info, setInfo] = useState("");

  const basculerVersCarte2D = useCallback((message) => {
    setRaison(message || "La carte 3D n'est pas disponible : retour à la carte 2D.");
    setEtat("repli");
    window.setTimeout(() => window.location.replace(ADRESSE_CARTE_2D), 2500);
  }, []);

  const appliquerMode = useCallback((active) => {
    const carte = carteRef.current;
    const ml = bibliothequeRef.current;
    if (!carte || !ml) return;
    if (active && !batimentsAjoutesRef.current) {
      // Chargement différé : le fichier des bâtiments n'est téléchargé qu'à la première activation de la 3D.
      carte.addSource("batiments", { type: "geojson", data: "/carte3d/batiments.geojson" });
      const premiereEtiquette = (carte.getStyle().layers || []).find((l) => l.type === "symbol")?.id;
      carte.addLayer(
        {
          id: "batiments-3d",
          type: "fill-extrusion",
          source: "batiments",
          minzoom: 13,
          paint: {
            "fill-extrusion-color": ["interpolate", ["linear"], ["get", "h"], 4, "#e7e9ee", 9, "#d5d9e0", 16, "#c2c7d0"],
            "fill-extrusion-height": ["get", "h"],
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.96,
            "fill-extrusion-vertical-gradient": true,
          },
        },
        premiereEtiquette
      );
      batimentsAjoutesRef.current = true;
    }
    if (batimentsAjoutesRef.current) carte.setLayoutProperty("batiments-3d", "visibility", active ? "visible" : "none");
    carte.easeTo({ pitch: active ? INCLINAISON_3D : 0, bearing: active ? -17 : 0, duration: 700 });
  }, []);

  useEffect(() => {
    const verdict = peutAfficher3D();
    if (!verdict.ok) {
      const t = window.setTimeout(() => basculerVersCarte2D(verdict.raison), 0);
      return () => window.clearTimeout(t);
    }
    let annule = false;
    let carte = null;
    let minuterie = null;
    let reperes = [];

    (async () => {
      try {
        const modMaplibre = await import("maplibre-gl");
        const ml = modMaplibre.default ?? modMaplibre;
        if (annule || !conteneurRef.current) return;
        bibliothequeRef.current = ml;
        // MapLibre 6 déduit l'adresse de son worker du chemin du fichier qui le contient : une fois empaqueté par Next, ce chemin est faux. Le worker (et son module partagé) sont donc servis
        // par le site lui-même, dans public/carte3d/ (copie exacte de node_modules/maplibre-gl/dist, à recopier à chaque mise à jour de maplibre-gl) ; worker-src 'self' de la CSP les autorise.
        ml.setWorkerUrl("/carte3d/maplibre-gl-worker.mjs");
        carte = new ml.Map({
          container: conteneurRef.current,
          style: STYLE_FOND,
          center: CENTRE_DEFAUT,
          zoom: 15.2,
          pitch: INCLINAISON_3D,
          bearing: -17,
          maxPitch: 70,
          attributionControl: false,
          cooperativeGestures: false,
        });
        carteRef.current = carte;
        if (typeof window !== "undefined") window.__carte3d = carte; // outil de diagnostic (aperçu), sans effet
        carte.addControl(new ml.AttributionControl({ compact: true, customAttribution: ATTRIBUTION_BATIMENTS }), "bottom-right");
        carte.addControl(new ml.NavigationControl({ visualizePitch: true }), "top-right");
        minuterie = window.setTimeout(() => {
          if (!annule && !carte.loaded()) basculerVersCarte2D("Le fond de carte met trop de temps à répondre : retour à la carte 2D.");
        }, DELAI_CHARGEMENT_MS);
        carte.on("error", (e) => {
          const msg = String(e?.error?.message || "");
          console.warn("[carte 3D] erreur MapLibre :", msg.slice(0, 200));
          if (!carte.loaded() && /style|Failed to fetch|NetworkError|webgl/i.test(msg)) basculerVersCarte2D("Le fond de carte est injoignable : retour à la carte 2D.");
        });
        carte.getCanvas().addEventListener("webglcontextlost", () => basculerVersCarte2D("L'affichage 3D a été interrompu par l'appareil : retour à la carte 2D."));
        carte.on("load", async () => {
          window.clearTimeout(minuterie);
          if (annule) return;
          appliquerMode(true);
          setEtat("pret");
          // Mesure de fluidité : sur 3 secondes, si l'image met en moyenne plus de 70 ms à s'afficher (moins de 14 images/s), on repasse la carte à plat.
          let n = 0;
          const debut = performance.now();
          const compter = () => {
            n += 1;
            if (performance.now() - debut < 3000 && !annule) requestAnimationFrame(compter);
            else if (!annule && (performance.now() - debut) / n > 70) {
              setMode3D(false);
              appliquerMode(false);
              setInfo("Votre appareil est un peu lent : la carte est passée en 2D pour rester fluide.");
            }
          };
          carte.easeTo({ zoom: 15.4, duration: 1200 });
          requestAnimationFrame(compter);
          try {
            const [articles, logos] = await Promise.all([chargerTousLesArticles({ limite: 500 }), chargerLogosBoutiques().catch(() => new Map())]);
            if (annule) return;
            const boutiques = construireBoutiques(articles, logos);
            reperes = boutiques.map((b) => {
              const el = elementRepere(b);
              const popup = new ml.Popup({ offset: [0, -88], closeButton: true, maxWidth: "220px" }).setHTML(
                `<div style="font:700 13px system-ui,sans-serif;color:#0f172a"><div>${echapperHtml(b.nom)}</div><div style="font-weight:600;color:#64748b;font-size:11px;margin-top:2px">${echapperHtml(b.quartier)} · ${b.nbArticles} article${b.nbArticles > 1 ? "s" : ""}</div><a href="${ADRESSE_CARTE_2D}" style="display:block;margin-top:8px;padding:6px 8px;border-radius:10px;background:#10b981;color:#fff;text-align:center;text-decoration:none;font-size:11px">Voir sur la carte 2D</a></div>`
              );
              return new ml.Marker({ element: el, anchor: "top-left", offset: [-70, -85] }).setLngLat([b.lng, b.lat]).setPopup(popup).addTo(carte);
            });
            // Vue de départ : le groupe de boutiques de la zone de Pikine / Guinaw Rails (à moins de 4 km du centre), assez près pour voir les bâtiments en volume. Les boutiques plus lointaines
            // (Keur Massar, Thiès...) restent sur la carte : on les atteint en déplaçant la carte.
            const proches = boutiques.filter((b) => Math.hypot((b.lng - CENTRE_DEFAUT[0]) * 107000, (b.lat - CENTRE_DEFAUT[1]) * 111000) < 4000);
            if (proches.length > 1) {
              const bornes = new ml.LngLatBounds();
              proches.forEach((b) => bornes.extend([b.lng, b.lat]));
              carte.fitBounds(bornes, { padding: 110, maxZoom: 16.2, pitch: INCLINAISON_3D, bearing: -17, duration: 1200 });
            }
          } catch {
            setInfo("Les boutiques n'ont pas pu être chargées pour le moment.");
          }
        });
      } catch (erreur) {
        console.error("[carte 3D] démarrage impossible :", erreur);
        if (!annule) basculerVersCarte2D("La carte 3D n'a pas pu démarrer : retour à la carte 2D.");
      }
    })();

    return () => {
      annule = true;
      window.clearTimeout(minuterie);
      reperes.forEach((r) => r.remove());
      if (carte) carte.remove();
      carteRef.current = null;
    };
  }, [appliquerMode, basculerVersCarte2D]);

  const surBascule = () => {
    const suivant = !mode3D;
    setMode3D(suivant);
    setInfo("");
    appliquerMode(suivant);
  };

  return (
    <div className="fixed inset-0 bg-[#e8eaee]" style={{ zIndex: 50 }}>
      <div ref={conteneurRef} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%" }} aria-label="Carte 3D des boutiques" />
      {etat === "chargement" && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#e8eaee] text-sm font-bold text-gray-600">Chargement de la carte 3D…</div>
      )}
      {etat === "repli" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#e8eaee] px-6 text-center">
          <p className="max-w-sm text-sm font-bold text-gray-800">{raison}</p>
          <a href={ADRESSE_CARTE_2D} className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-black text-white">
            Ouvrir la carte 2D
          </a>
        </div>
      )}
      {etat === "pret" && (
        <>
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <a
              href={ADRESSE_CARTE_2D}
              className="rounded-full bg-white/95 px-3.5 py-2 text-xs font-black text-gray-900 shadow-lg"
              aria-label="Retour à la carte 2D"
            >
              ← Carte 2D
            </a>
            <button
              type="button"
              onClick={surBascule}
              aria-pressed={mode3D}
              className="rounded-full bg-gray-900 px-4 py-2 text-xs font-black text-white shadow-lg"
              title={mode3D ? "Passer en vue plate" : "Passer en 3D"}
            >
              {mode3D ? "3D → 2D" : "2D → 3D"}
            </button>
            <span className="rounded-full bg-amber-400 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-gray-900">Prototype</span>
          </div>
          {info && <div className="absolute inset-x-3 bottom-10 rounded-2xl bg-gray-900/90 px-4 py-3 text-center text-xs font-bold text-white shadow-xl">{info}</div>}
        </>
      )}
    </div>
  );
}
