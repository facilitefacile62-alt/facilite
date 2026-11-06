"use client";
// Carte 3D de Locaux (PROTOTYPE) — même interface que la carte « Autour de moi » : barre de recherche, rangée de touches, bulles Carrousel sur chaque boutique, bande de boutiques en bas.
// SEUL le bouton 2D/3D change le rendu de la carte (volumes et inclinaison, ou carte à plat).
//
// Données : fond OpenFreeMap (style « positron », sans clé) ; bâtiments Overture (voir scripts/carte3d/extraire-batiments.py), fichier statique public/carte3d/batiments.geojson chargé SEULEMENT à la
// première activation de la 3D. Les boutiques sont chargées comme sur la carte 2D (mêmes fonctions publiques) : rien de plus que la carte actuelle, aucune coordonnée dans le HTML.
// Repli : appareil trop faible, WebGL absent, fond injoignable, carte trop lente => retour à la carte 2D actuelle (ou carte à plat).
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ADRESSE_CARTE_2D, DUREE_MAX_VUE_PHOTO_MS, PLAFOND_BOUTIQUES, cartePhotoActive, peutAfficher3D, profilPhoto } from "@/lib/carte3d";
import { chargerLogosBoutiques, chargerTousLesArticles, echapperHtml, urlPhoto } from "@/lib/marketplaceData";
import { htmlEpingle } from "@/lib/epingleCarte";
import { svgAvatarBoutique } from "@/lib/avatarBoutique";
import { adresseImage } from "@/lib/imagesPubliques";
import { placerEpingles, selectionnerVisibles } from "@/lib/ecartementEpingles";
import { boutiquesVisibles } from "@/lib/boutiquesTest";

const STYLE_FOND = "https://tiles.openfreemap.org/styles/positron";
const CENTRE_DEFAUT = [-17.384, 14.756]; // [lng, lat] : Pikine
const INCLINAISON_3D = 60;
const DELAI_CHARGEMENT_MS = 15000;
const ATTRIBUTION_BATIMENTS = "Bâtiments : © Overture Maps Foundation, OpenStreetMap contributors";
const DELAI_PREMIERES_TUILES_MS = 60000; // 60 s maximum entre l'appui et l'AFFICHAGE de la première tuile (connexion lente comprise)
const MONTRER_MESURES = process.env.NEXT_PUBLIC_VERCEL_ENV === "preview"; // zone de mesures : aperçus seulement
const EN_PREVIEW = process.env.NEXT_PUBLIC_VERCEL_ENV === "preview"; // les boutiques de test (voir src/lib/boutiquesTest.js) ne sont affichées que sur les aperçus
const DEBUT_MESSAGE_LENT = "Votre appareil est un peu lent pour la vue photo";
// Réglage d'essai : « ?photo=sans-coupure » dans l'adresse désactive les coupures automatiques de fluidité (carte grise comprise) et affiche la durée moyenne par image dans la zone de mesures.
const sansCoupureDemande = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("photo") === "sans-coupure";
const MESSAGE_REPLI_PHOTO = "La vue 3D photo n'est pas disponible pour le moment (limite d'utilisation atteinte ou accès refusé). La vue 3D simple reste affichée.";

function prixLisible(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("fr-FR") : "0";
}

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
      articles: (articles || []).filter((r) => r.boutique_id === a.boutique_id),
    });
  }
  return liste;
}

function contenuAvatar(b, taille) {
  try {
    // Images publiques servies par le Worker « facilite-images » (cache d'un an) quand NEXT_PUBLIC_IMAGES_HOTE est posée : AFFICHAGE seulement, rien n'est réécrit en base. Interrupteur fermé : adresse inchangée.
    if (b.logo_url) return `<img src="${echapperHtml(adresseImage(b.logo_url))}" alt="" style="width:100%;height:100%;object-fit:cover;" />`;
    if (b.avatar_config) return svgAvatarBoutique(b.avatar_config, taille);
  } catch {
    /* repli : pictogramme */
  }
  return null;
}

function elementRepere(b) {
  const boite = document.createElement("div");
  // Seule la GOUTTE (44 × 56 px, .epingle-pin) reçoit les touches : la boîte de 140 × 90 px qui l'entoure est transparente aux clics, sinon les boîtes d'épingles voisines (écartées de 48 px) se recouvriraient
  // et la touche irait à la mauvaise boutique. Le clic remonte de la goutte à cette boîte (l'écouteur est posé dessus).
  boite.style.cssText = "width:140px;height:90px;cursor:pointer;pointer-events:none;";
  boite.innerHTML = htmlEpingle({ couleur: "#10B981", type: "produit", nom: echapperHtml(String(b.nom).slice(0, 18)), contenuHtml: contenuAvatar(b, 52) });
  const pin = boite.querySelector(".epingle-pin");
  if (pin) pin.style.pointerEvents = "auto";
  return boite;
}

// Point + trait d'une épingle ÉCARTÉE (placement anti-chevauchement) : le point marque le VRAI emplacement de la boutique, le trait le relie à la pointe de l'épingle déplacée. Élément de taille nulle posé sur
// l'emplacement vrai ; le trait part de (0, 0) vers (dx, dy). Masqué quand l'épingle n'est pas déplacée.
function elementAncre() {
  const el = document.createElement("div");
  el.style.cssText = "width:0;height:0;pointer-events:none;display:none;";
  el.innerHTML = '<svg width="1" height="1" style="position:absolute;left:0;top:0;overflow:visible;pointer-events:none;" aria-hidden="true"><line class="trait-halo" x1="0" y1="0" x2="0" y2="0" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><line class="trait" x1="0" y1="0" x2="0" y2="0" stroke="#0f172a" stroke-width="1.5" stroke-linecap="round"/><circle cx="0" cy="0" r="4.5" fill="#0f172a" stroke="#fff" stroke-width="1.5"/></svg>';
  return el;
}

function majAncre(el, dx, dy) {
  if (!el) return;
  const deplace = Boolean(dx || dy);
  el.style.display = deplace ? "" : "none";
  if (!deplace) return;
  el.querySelectorAll("line").forEach((l) => {
    l.setAttribute("x2", String(dx));
    l.setAttribute("y2", String(dy));
  });
}

// Bulle « Carrousel » d'une boutique : nom, quartier, deux articles visibles à la fois, flèches gauche / droite.
function htmlBulle(b, largeur = 140) {
  const cartes = b.articles
    .slice(0, 12)
    .map((a) => {
      const photo = a.photos?.[0] ? adresseImage(urlPhoto(a.photos[0])) : "";
      const image = photo
        ? `<img src="${echapperHtml(photo)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" />`
        : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:22px;">🛍️</div>`;
      return `<div style="flex-shrink:0;width:66px;"><div style="width:66px;height:86px;border-radius:14px;overflow:hidden;background:#c4a4b8;position:relative;box-shadow:0 3px 10px rgba(0,0,0,.15);">${image}${a.__badge ? `<div style="position:absolute;top:4px;left:4px;width:22px;height:22px;border-radius:9999px;overflow:hidden;background:#fff;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:12px;">${a.__badge}</div>` : ""}<div style="position:absolute;bottom:0;left:0;right:0;padding:5px 4px 3px;background:linear-gradient(to top,rgba(0,0,0,.88),rgba(0,0,0,.35) 70%,transparent);color:#fff;"><div style="font-size:8px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${echapperHtml(a.titre || "Article")}</div><div style="font-size:9px;font-weight:900;color:#34d399;">${prixLisible(a.prix_xof)} F</div></div></div></div>`;
    })
    .join("");
  const bouton = (cote) =>
    `<button type="button" data-fl="${cote}" aria-label="${cote === "g" ? "Précédents" : "Suivants"}" style="position:absolute;${cote === "g" ? "left" : "right"}:-8px;top:30px;width:26px;height:26px;border-radius:9999px;border:none;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.35);font-size:18px;font-weight:900;line-height:24px;cursor:pointer;display:none;padding:0;">${cote === "g" ? "‹" : "›"}</button>`;
  const corps = b.articles.length
    ? `<div style="position:relative;"><div class="bande3d" style="width:${largeur}px;margin:0 auto;display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding:2px 1px 4px;">${cartes}</div>${bouton("g")}${bouton("d")}</div>`
    : `<div style="font-size:10px;color:#64748b;padding:6px 0;">Pas encore d'article.</div>`;
  return `<div style="position:relative;width:${largeur + 32}px;font-family:system-ui,sans-serif;color:#0f172a;"><div style="margin-bottom:6px;"><div style="font-size:12px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${echapperHtml(b.nom)}</div><div style="font-size:9.5px;font-weight:600;color:#64748b;margin-top:2px;">📍 ${echapperHtml(b.quartier)} · ${b.articles.length} article${b.articles.length > 1 ? "s" : ""}</div></div>${corps}</div>`;
}

function brancherFleches(racine) {
  const bande = racine.querySelector(".bande3d");
  if (!bande) return;
  const g = racine.querySelector('[data-fl="g"]');
  const d = racine.querySelector('[data-fl="d"]');
  const maj = () => {
    g.style.display = bande.scrollLeft > 2 ? "block" : "none";
    d.style.display = bande.scrollLeft + bande.clientWidth < bande.scrollWidth - 2 ? "block" : "none";
  };
  g.onclick = () => bande.scrollBy({ left: -148, behavior: "smooth" });
  d.onclick = () => bande.scrollBy({ left: 148, behavior: "smooth" });
  bande.addEventListener("scroll", maj, { passive: true });
  window.setTimeout(maj, 60);
  window.setTimeout(maj, 500);
}

const CHIP = "shrink-0 px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap shadow-md flex items-center gap-1.5 cursor-pointer";
const chipEtat = (actif) => `${CHIP} ${actif ? "bg-white text-gray-950" : "bg-gray-900/90 text-white border border-gray-700"}`;

export default function Carte3D() {
  const conteneurRef = useRef(null);
  const carteRef = useRef(null);
  const bibliothequeRef = useRef(null);
  const batimentsAjoutesRef = useRef(false);
  const [etat, setEtat] = useState("chargement"); // chargement | pret | repli
  const [raison, setRaison] = useState("");
  const [mode3D, setMode3D] = useState(true);
  const [carrousel, setCarrousel] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [boutiques, setBoutiques] = useState([]);
  const [filtre, setFiltre] = useState("tous"); // tous | live
  const [info, setInfo] = useState("");
  // Vue 3D photo (Google) : « off » | « chargement » | « on ». Chargée SEULEMENT à l'appui sur le bouton ; interrupteur séparé NEXT_PUBLIC_CARTE_3D_PHOTO (voir src/lib/carte3d.js).
  const photoPossible = cartePhotoActive();
  const [photo, setPhoto] = useState("off");
  const [creditsPhoto, setCreditsPhoto] = useState("");
  const [creditsOuverts, setCreditsOuverts] = useState(false);
  const [mesures, setMesures] = useState(null);
  const photoRef = useRef(null);
  const minuterieSessionRef = useRef(null);
  const delaiChargementRef = useRef(null);
  const [panneau, setPanneau] = useState(null); // vue photo : { boutiques, index } : carrousel de la boutique choisie, panneau FIXE en bas de l'écran
  const panneauRef = useRef(null);
  const dialogueRef = useRef(null);
  const [basAttribution, setBasAttribution] = useState(null); // vue grise : hauteur (px) à partir du bas de l'écran au-dessus de laquelle la mention des données est replacée quand le panneau est ouvert
  const hauteursRef = useRef(new Map()); // identifiant de boutique -> { bas, altitude, ge } : hauteur du sol lue sous l'épingle (vue photo)
  const conteneurPinsRef = useRef(null); // calque des épingles de la vue photo (positionnées image par image à leur hauteur)
  const entreesPinsRef = useRef([]); // [{ id, el, ancreEl, marqueurPin, marqueurAncre, lat, lng, nom, dx, dy }]
  const dernierCentreRef = useRef(0);
  const [hauteurCentre, setHauteurCentre] = useState(null); // zone de mesures : hauteur lue pour l'épingle la plus proche du centre de l'écran
  const reperesRef = useRef(new Map()); // identifiant de boutique -> élément de l'épingle (pour la mettre au premier plan)
  const racineRef = useRef(null);
  const planifRef = useRef(null);
  const [visibles, setVisibles] = useState({ sig: "", liste: [] }); // boutiques affichées dans la vue (plafonnées)
  const [avisPlafond, setAvisPlafond] = useState(""); // avis (jamais silencieux) quand le plafond de boutiques affichées est atteint
  const [zoomActuel, setZoomActuel] = useState(null); // zoom de la carte en vue photo (zone de mesures des aperçus)
  const [fluidite, setFluidite] = useState(null); // { moyenneMs, imagesParS } : affiché seulement avec ?photo=sans-coupure
  const mode3DRef = useRef(true);
  useEffect(() => {
    if (!MONTRER_MESURES) return undefined;
    window.__injecterBoutiques = (liste) => setBoutiques(liste); // outil de diagnostic des aperçus (essais de performance avec de fausses boutiques), sans effet
    return () => {
      delete window.__injecterBoutiques;
    };
  }, []);
  useEffect(() => {
    mode3DRef.current = mode3D;
  }, [mode3D]);

  const basculerVersCarte2D = useCallback((message) => {
    setRaison(message || "La carte 3D n'est pas disponible : retour à la carte 2D.");
    setEtat("repli");
    window.setTimeout(() => window.location.replace(ADRESSE_CARTE_2D), 2500);
  }, []);

  // Retire la vue photo (libère les tuiles et le réseau) et remet le prototype gris tel qu'il était.
  const retirerPhoto = useCallback(() => {
    window.clearTimeout(minuterieSessionRef.current);
    window.clearTimeout(delaiChargementRef.current);
    try {
      photoRef.current?.retirer();
    } catch {
      /* déjà retirée */
    }
    photoRef.current = null;
    setPhoto("off");
    setCreditsPhoto("");
    setPanneau(null);
    setHauteurCentre(null);
    hauteursRef.current = new Map();
    const carte = carteRef.current;
    if (carte) {
      try {
        carte.setMaxPitch(70);
        carte.setMaxZoom(22);
        if (batimentsAjoutesRef.current) carte.setLayoutProperty("batiments-3d", "visibility", mode3DRef.current ? "visible" : "none");
      } catch {
        /* carte déjà détruite */
      }
    }
  }, []);

  const appliquerMode = useCallback((active) => {
    const carte = carteRef.current;
    if (!carte) return;
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

    (async () => {
      try {
        const modMaplibre = await import("maplibre-gl");
        const ml = modMaplibre.default ?? modMaplibre;
        if (annule || !conteneurRef.current) return;
        bibliothequeRef.current = ml;
        // MapLibre 6 déduit l'adresse de son worker du chemin du fichier qui le contient : une fois empaqueté par Next, ce chemin est faux. Le worker (et son module partagé) sont donc servis
        // par le site lui-même, dans public/carte3d/ (copie exacte de node_modules/maplibre-gl/dist, à recopier à chaque mise à jour de maplibre-gl) ; worker-src 'self' de la CSP les autorise.
        ml.setWorkerUrl("/carte3d/maplibre-gl-worker.mjs");
        carte = new ml.Map({ container: conteneurRef.current, style: STYLE_FOND, center: CENTRE_DEFAUT, zoom: 15.2, pitch: INCLINAISON_3D, bearing: -17, maxPitch: 70, attributionControl: false });
        carteRef.current = carte;
        if (typeof window !== "undefined") window.__carte3d = carte; // outil de diagnostic (aperçu), sans effet
        carte.addControl(new ml.AttributionControl({ compact: true, customAttribution: ATTRIBUTION_BATIMENTS }), "bottom-right");
        minuterie = window.setTimeout(() => {
          if (!annule && !carte.loaded()) basculerVersCarte2D("Le fond de carte met trop de temps à répondre : retour à la carte 2D.");
        }, DELAI_CHARGEMENT_MS);
        carte.on("error", (e) => {
          const msg = String(e?.error?.message || "");
          if (!carte.loaded() && /style|Failed to fetch|NetworkError|webgl/i.test(msg)) basculerVersCarte2D("Le fond de carte est injoignable : retour à la carte 2D.");
        });
        carte.getCanvas().addEventListener("webglcontextlost", () => basculerVersCarte2D("L'affichage 3D a été interrompu par l'appareil : retour à la carte 2D."));
        carte.on("load", async () => {
          window.clearTimeout(minuterie);
          if (annule) return;
          appliquerMode(true);
          setEtat("pret");
          // Fluidité : sur 3 secondes, moins de 14 images par seconde => la carte repasse à plat.
          let n = 0;
          const debut = performance.now();
          const compter = () => {
            n += 1;
            if (performance.now() - debut < 3000 && !annule) requestAnimationFrame(compter);
            else if (!annule && !sansCoupureDemande() && (performance.now() - debut) / n > 70) {
              setMode3D(false);
              appliquerMode(false);
              setInfo("Votre appareil est un peu lent : la carte est passée en 2D pour rester fluide.");
            }
          };
          requestAnimationFrame(compter);
          try {
            const [articles, logos] = await Promise.all([chargerTousLesArticles({ limite: 500 }), chargerLogosBoutiques().catch(() => new Map())]);
            if (annule) return;
            const liste = boutiquesVisibles(construireBoutiques(articles, logos), EN_PREVIEW);
            setBoutiques(liste);
            const proches = liste.filter((b) => Math.hypot((b.lng - CENTRE_DEFAUT[0]) * 107000, (b.lat - CENTRE_DEFAUT[1]) * 111000) < 4000);
            if (proches.length > 1) {
              const bornes = new ml.LngLatBounds();
              proches.forEach((b) => bornes.extend([b.lng, b.lat]));
              carte.fitBounds(bornes, { padding: 120, maxZoom: 16, pitch: INCLINAISON_3D, bearing: -17, duration: 1200 });
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
      window.clearTimeout(minuterieSessionRef.current);
      try {
        photoRef.current?.retirer();
      } catch {
        /* déjà retirée */
      }
      photoRef.current = null;
      if (carte) carte.remove();
      carteRef.current = null;
    };
  }, [appliquerMode, basculerVersCarte2D]);

  // Boutiques affichées : filtre « En stock » et recherche (nom, quartier ou article), comme sur la carte 2D.
  const affichees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return boutiques.filter((b) => {
      if (filtre === "live" && !b.articles.some((a) => a.statut === "en_stock" || a.quantite > 0)) return false;
      if (!q) return true;
      return `${b.nom} ${b.quartier}`.toLowerCase().includes(q) || b.articles.some((a) => String(a.titre || "").toLowerCase().includes(q));
    });
  }, [boutiques, filtre, recherche]);

  // Vue photo : chaque épingle est posée à SA hauteur dans la scène (sol lu sous elle ; 0 m par défaut = la constante DECALAGE_VERTICAL_PHOTO_M amène le sol de Dakar Plateau à ~0 m) et suit la photo image par image
  // (même projection que deck.gl) : plus de décalage quand on change l'inclinaison ou la rotation.
  const placerPins = useCallback(() => {
    const ctl = photoRef.current;
    const conteneur = conteneurPinsRef.current;
    const entrees = entreesPinsRef.current;
    if (!ctl || !conteneur || !entrees.length) return;
    const points = entrees.map((e) => [e.lng, e.lat, hauteursRef.current.get(e.id)?.altitude ?? 0]);
    const pixels = ctl.projeter(points);
    const cx = conteneur.clientWidth / 2;
    const cy = conteneur.clientHeight / 2;
    let plusProche = null;
    entrees.forEach((e, i) => {
      const [x, y] = pixels[i];
      // L'épingle est décalée dans le PLAN DE L'ÉCRAN (placement anti-chevauchement) ; le point et le trait restent sur le vrai emplacement, à la hauteur lue du sol.
      e.el.style.transform = `translate(${Math.round((x - 70 + (e.dx || 0)) * 10) / 10}px, ${Math.round((y - 85 + (e.dy || 0)) * 10) / 10}px)`;
      e.el.style.visibility = "visible";
      e.ancreEl.style.transform = `translate(${Math.round(x * 10) / 10}px, ${Math.round(y * 10) / 10}px)`;
      const d = Math.hypot(x - cx, y - cy);
      if (plusProche === null || d < plusProche.d) plusProche = { d, e };
    });
    // Mesure affichée (aperçus) : au plus une fois par seconde.
    const maintenant = Date.now();
    if (MONTRER_MESURES && plusProche && maintenant - dernierCentreRef.current > 1000) {
      dernierCentreRef.current = maintenant;
      const lue = hauteursRef.current.get(plusProche.e.id) || null;
      setHauteurCentre({ nom: plusProche.e.nom, bas: lue?.bas ?? null, altitude: lue?.altitude ?? null, ge: lue?.ge ?? null });
    }
  }, []);
  useEffect(() => {
    const carte = carteRef.current;
    if (photo !== "on" || !carte) return undefined;
    carte.on("render", placerPins);
    return () => carte.off("render", placerPins);
  }, [photo, placerPins]);

  // PLACEMENT ANTI-CHEVAUCHEMENT (deux vues) : chaque boutique garde son épingle ; celles qui se recouvrent à l'écran sont écartées en lignes (voir src/lib/ecartementEpingles.js), avec un point sur le vrai emplacement et un trait.
  // Recalculé quand la carte s'arrête de bouger ou de zoomer (moveend), quand la fenêtre change de taille, quand le panneau s'ouvre ou se ferme, ou quand la hauteur du sol lue change — jamais à chaque image :
  // entre deux calculs, les épingles suivent la carte d'un bloc (décalage en pixels constant).
  const recalculerPlacement = useCallback(() => {
    const carte = carteRef.current;
    const racine = racineRef.current;
    const entrees = entreesPinsRef.current;
    if (!carte || !racine || !entrees.length) return;
    const t0 = performance.now();
    const enPhoto = Boolean(photoRef.current && conteneurPinsRef.current);
    const pixels = enPhoto
      ? photoRef.current.projeter(entrees.map((e) => [e.lng, e.lat, hauteursRef.current.get(e.id)?.altitude ?? 0]))
      : entrees.map((e) => {
          const p = carte.project([e.lng, e.lat]);
          return [p.x, p.y];
        });
    const rr = racine.getBoundingClientRect();
    const interdits = [];
    racine.querySelectorAll("[data-zone-interdite]").forEach((z) => {
      const r = z.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) interdits.push({ x0: r.left - rr.left - 4, y0: r.top - rr.top - 4, x1: r.right - rr.left + 4, y1: r.bottom - rr.top + 4 });
    });
    // Éléments du SITE superposés à la carte, hors de notre composant (bouton vert « + » des raccourcis, etc.) : position fixe, au-dessus de la carte (z-index >= 50, la carte est à 50), visibles, qui ne sont pas un voile plein écran.
    // Chacun devient une zone interdite (marge de 13 px : le bouton de 64 px donne ~90 × 90 px).
    document.querySelectorAll(".fixed, [style*='position: fixed'], [style*='position:fixed']").forEach((el) => {
      if (racine.contains(el)) return;
      const st = window.getComputedStyle(el);
      if (st.position !== "fixed" || st.display === "none" || st.visibility === "hidden" || Number(st.opacity) === 0) return;
      if (!(Number.parseInt(st.zIndex, 10) >= 50)) return;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0 || (r.width > window.innerWidth * 0.9 && r.height > window.innerHeight * 0.9)) return;
      interdits.push({ x0: r.left - rr.left - 13, y0: r.top - rr.top - 13, x1: r.right - rr.left + 13, y1: r.bottom - rr.top + 13 });
    });
    // Repli fixe : coin bas droit d'environ 90 × 90 px où se trouve le bouton « + » du site (bottom-32 right-4 : 64 px de côté, à 128 px du bas), même si le bouton est absent ou introuvable.
    interdits.push({ x0: racine.clientWidth - 100, y0: racine.clientHeight - 205, x1: racine.clientWidth, y1: racine.clientHeight - 115 });
    const res = placerEpingles({ items: entrees.map((e, i) => ({ id: e.id, x: pixels[i][0], y: pixels[i][1] })), interdits, ecran: { x0: 0, y0: 0, x1: racine.clientWidth, y1: racine.clientHeight } });
    entrees.forEach((e) => {
      const d = res.get(e.id) || { dx: 0, dy: 0 };
      e.dx = d.dx;
      e.dy = d.dy;
      majAncre(e.ancreEl, d.dx, d.dy);
      if (e.marqueurPin) e.marqueurPin.setOffset([-70 + d.dx, -85 + d.dy]);
    });
    if (enPhoto) placerPins();
    if (MONTRER_MESURES) {
      const durees = (window.__dureesPlacement = window.__dureesPlacement || []);
      durees.push(Math.round((performance.now() - t0) * 10) / 10);
      if (durees.length > 200) durees.shift();
    }
  }, [placerPins]);
  const planifierPlacement = useCallback(
    (delai = 80) => {
      window.clearTimeout(planifRef.current);
      planifRef.current = window.setTimeout(recalculerPlacement, delai);
    },
    [recalculerPlacement]
  );
  useEffect(() => {
    const carte = carteRef.current;
    if (etat !== "pret" || !carte) return undefined;
    const surMouvement = () => planifierPlacement(60);
    const surTaille = () => planifierPlacement(150);
    carte.on("moveend", surMouvement);
    window.addEventListener("resize", surTaille);
    return () => {
      carte.off("moveend", surMouvement);
      window.removeEventListener("resize", surTaille);
      window.clearTimeout(planifRef.current);
    };
  }, [etat, planifierPlacement]);

  // Boutiques affichées dans la vue : plafond réglable (NEXT_PUBLIC_CARTE_3D_PLAFOND_BOUTIQUES, 150 par défaut). Au-delà : la boutique choisie, puis celles qui ont des articles EN STOCK, puis celles qui ont le plus d'articles,
  // puis les plus proches du centre ; un avis est affiché (jamais de choix silencieux). Recalculé quand la carte s'arrête, pas à chaque image.
  const idChoisi = panneau ? panneau.boutiques[0]?.id ?? null : null;
  useEffect(() => {
    const carte = carteRef.current;
    if (etat !== "pret" || !carte) return undefined;
    const maj = () => {
      const conteneur = carte.getContainer();
      const positions = affichees.map((b) => {
        const p = carte.project([b.lng, b.lat]);
        return { id: b.id, x: p.x, y: p.y, enStock: b.articles.some((a) => a.statut === "en_stock" || a.quantite > 0), nbArticles: b.articles.length };
      });
      const sel = selectionnerVisibles(positions, { plafond: PLAFOND_BOUTIQUES, idChoisi, ecran: { x0: 0, y0: 0, x1: conteneur.clientWidth, y1: conteneur.clientHeight } });
      const liste = affichees.filter((b) => sel.retenues.has(b.id));
      const sig = liste.map((b) => b.id).join("|");
      setVisibles((prec) => (prec.sig === sig ? prec : { sig, liste }));
      setAvisPlafond(sel.masquees > 0 ? `${sel.masquees} boutique${sel.masquees > 1 ? "s" : ""} de plus dans cette zone : les ${sel.retenues.size} plus utiles (en stock d'abord) sont affichées. Zoomez pour voir les autres.` : "");
    };
    maj();
    carte.on("moveend", maj);
    return () => carte.off("moveend", maj);
  }, [etat, affichees, idChoisi]);

  // Garde-fou : MapLibre borne molette, pincement, double clic, clavier, easeTo, flyTo et jumpTo par le zoom maximal, mais PAS fitBounds (essai local : fitBounds avec maxZoom 22 est arrivé à 18,2 alors que le maximum était 17).
  // Si le zoom dépasse le maximum en vue photo, on le ramène au maximum.
  useEffect(() => {
    const carte = carteRef.current;
    if (photo !== "on" || !carte) return undefined;
    const borner = () => {
      const max = carte.getMaxZoom();
      if (carte.getZoom() > max + 0.01) carte.jumpTo({ zoom: max });
    };
    borner();
    carte.on("zoomend", borner);
    return () => carte.off("zoomend", borner);
  }, [photo]);
  // Zoom affiché dans la zone de mesures (aperçus) : suivi pendant la vue photo.
  useEffect(() => {
    const carte = carteRef.current;
    if (photo !== "on" || !carte || !MONTRER_MESURES) return undefined;
    const maj = () => setZoomActuel({ zoom: Math.round(carte.getZoom() * 100) / 100, max: Math.round(carte.getMaxZoom() * 100) / 100 });
    maj();
    carte.on("zoom", maj);
    return () => carte.off("zoom", maj);
  }, [photo]);

  // Épingles : une par boutique affichée (jamais de regroupement). Vue grise : repères MapLibre (+ un repère « point » pour les épingles écartées). Vue photo : éléments simples dans le calque, positionnés image par image.
  // Le carrousel de la boutique touchée s'ouvre dans le panneau fixe (un seul à la fois) ; l'épingle touchée passe devant ; touche « Carrousel » éteinte en vue grise : les épingles n'ouvrent rien.
  useEffect(() => {
    const carte = carteRef.current;
    const ml = bibliothequeRef.current;
    if (!carte || !ml || etat !== "pret") return undefined;
    const enPhoto = photo === "on";
    if (enPhoto && !conteneurPinsRef.current) return undefined;
    reperesRef.current = new Map();
    const entrees = visibles.liste.map((b) => ({ id: b.id, b, lat: b.lat, lng: b.lng, nom: b.nom, el: null, ancreEl: elementAncre(), marqueurPin: null, marqueurAncre: null, dx: 0, dy: 0 }));
    // 1) points + traits d'abord (sous les épingles)
    entrees.forEach((e) => {
      if (enPhoto) {
        e.ancreEl.style.cssText += "position:absolute;left:0;top:0;z-index:0;will-change:transform;";
        conteneurPinsRef.current.appendChild(e.ancreEl);
      } else {
        e.marqueurAncre = new ml.Marker({ element: e.ancreEl, anchor: "center" }).setLngLat([e.lng, e.lat]).addTo(carte);
      }
    });
    // 2) épingles
    entrees.forEach((e) => {
      const el = elementRepere(e.b);
      e.el = el;
      reperesRef.current.set(e.id, el);
      if (enPhoto) {
        el.style.cssText += "position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;will-change:transform;z-index:1;";
        conteneurPinsRef.current.appendChild(el);
      } else {
        e.marqueurPin = new ml.Marker({ element: el, anchor: "top-left", offset: [-70, -85] }).setLngLat([e.lng, e.lat]).addTo(carte);
      }
      el.addEventListener("click", (ev) => {
        ev.stopPropagation(); // le clic sur une épingle ne ferme pas le panneau (clic sur la carte)
        if (enPhoto || carrousel) setPanneau({ boutiques: [e.b], index: 0 });
      });
    });
    entreesPinsRef.current = entrees;
    if (enPhoto && photoRef.current) {
      photoRef.current.definirLieux(entrees.map((e) => ({ id: e.id, lat: e.lat, lng: e.lng })));
      placerPins();
    }
    planifierPlacement(0);
    return () => {
      window.clearTimeout(planifRef.current);
      entrees.forEach((e) => {
        e.marqueurPin?.remove();
        e.marqueurAncre?.remove();
        e.el?.remove();
        e.ancreEl?.remove();
      });
      if (entreesPinsRef.current === entrees) entreesPinsRef.current = [];
    };
  }, [visibles, carrousel, etat, photo, placerPins, planifierPlacement]);

  // Vue photo : l'épingle choisie passe devant les autres (même si deux épingles se chevauchent) et le carrousel reste dans le panneau fixe ; un clic sur la carte ferme le panneau.
  useEffect(() => {
    const choisie = panneau ? panneau.boutiques[0]?.id : null;
    reperesRef.current.forEach((el, id) => {
      el.style.zIndex = id === choisie ? "10" : photo === "on" ? "1" : "";
    });
  }, [panneau, visibles, photo]);
  // Le panneau qui s'ouvre ou se ferme change la zone libre (il devient une zone interdite) : le placement est recalculé.
  useEffect(() => {
    planifierPlacement(250);
  }, [panneau, avisPlafond, info, planifierPlacement]);
  useEffect(() => {
    const carte = carteRef.current;
    if (etat !== "pret" || !carte) return undefined;
    const fermer = () => setPanneau(null);
    carte.on("click", fermer);
    return () => carte.off("click", fermer);
  }, [etat]);
  // Sur téléphone, le panneau est aligné à gauche et laisse ~104 px libres à droite pour le bouton « + » du site (jamais recouvert) : le carrousel s'adapte à l'espace restant (140 à 276 px).
  const largeurCarrousel = typeof window !== "undefined" ? Math.max(140, Math.min(276, window.innerWidth - 188)) : 276;
  // Vue grise : la mention OpenFreeMap / OpenStreetMap / Overture est une OBLIGATION de licence des données ; quand le panneau est ouvert, elle est replacée juste AU-DESSUS du panneau (jamais cachée).
  const panneauOuvertGris = Boolean(panneau) && photo !== "on";
  useEffect(() => {
    const el = dialogueRef.current;
    if (!panneauOuvertGris || !el) return undefined;
    const mesurer = () => setBasAttribution(Math.max(104, Math.round(window.innerHeight - el.getBoundingClientRect().top + 8)));
    mesurer();
    const obs = typeof ResizeObserver !== "undefined" ? new ResizeObserver(mesurer) : null;
    obs?.observe(el);
    window.addEventListener("resize", mesurer);
    return () => {
      obs?.disconnect();
      window.removeEventListener("resize", mesurer);
      setBasAttribution(null);
    };
  }, [panneauOuvertGris, panneau]);
  const boutiqueDuPanneau = panneau ? panneau.boutiques[Math.min(panneau.index, panneau.boutiques.length - 1)] : null;
  useEffect(() => {
    if (panneauRef.current && boutiqueDuPanneau) brancherFleches(panneauRef.current);
  }, [boutiqueDuPanneau]);

  const surBascule = () => {
    const suivant = !mode3D;
    if (!suivant && photoRef.current) retirerPhoto();
    setMode3D(suivant);
    setInfo("");
    appliquerMode(suivant);
  };

  const lancerPhoto = async (forcer) => {
    const carte = carteRef.current;
    if (!carte || photo === "chargement") return;
    if (photo === "on") {
      retirerPhoto();
      return;
    }
    // Une réactivation pendant la session Google ne redemande PAS la racine (gardée en mémoire par carte3dPhoto.js) ; le plafond de racines par page y est appliqué.
    const sansCoupure = forcer || sansCoupureDemande();
    setPhoto("chargement");
    setInfo("");
    setMesures(null);
    setFluidite(null);
    try {
      const { creerVuePhoto } = await import("@/lib/carte3dPhoto");
      const profil = profilPhoto();
      if (!mode3DRef.current) {
        setMode3D(true);
        appliquerMode(true);
      }
      // Délai maximal : si aucune tuile n'est AFFICHÉE en 60 secondes, on retombe sur le prototype gris (la requête déjà partie ne coûte rien de plus).
      let abandon = false; // vrai si le délai ou une erreur a déjà ramené le prototype gris pendant que le module se chargeait
      window.clearTimeout(delaiChargementRef.current);
      delaiChargementRef.current = window.setTimeout(() => {
        abandon = true;
        retirerPhoto();
        setInfo("La vue 3D photo met trop de temps à répondre : la vue 3D simple est affichée.");
      }, DELAI_PREMIERES_TUILES_MS);
      // Fluidité : mesurée SEULEMENT une fois les premières tuiles affichées (puis 3 s de pause) ; sur 4 secondes, plus de 90 ms par image en moyenne => retour au prototype gris.
      const mesurerEnContinu = () => {
        // Moyenne sur 1 seconde, affichée dans la zone de mesures des aperçus (jamais de coupure ici).
        let dernier = 0;
        let debutFenetre = 0;
        let somme = 0;
        let n = 0;
        const boucle = (t) => {
          if (!photoRef.current) return;
          if (dernier) {
            somme += t - dernier;
            n += 1;
          }
          dernier = t;
          if (!debutFenetre) debutFenetre = t;
          if (t - debutFenetre >= 1000 && n > 0) {
            const moyenne = somme / n;
            setFluidite({ moyenneMs: Math.round(moyenne), imagesParS: Math.round(1000 / moyenne) });
            somme = 0;
            n = 0;
            debutFenetre = t;
          }
          requestAnimationFrame(boucle);
        };
        requestAnimationFrame(boucle);
      };
      const surveillerFluidite = () => {
        if (MONTRER_MESURES || sansCoupure) mesurerEnContinu();
        if (sansCoupure) return;
        let n = 0;
        let debut = 0;
        const compter = (t) => {
          if (!photoRef.current) return;
          if (!debut) debut = t;
          n += 1;
          if (t - debut < 4000) requestAnimationFrame(compter);
          else if ((t - debut) / n > 90) {
            retirerPhoto();
            setInfo(`${DEBUT_MESSAGE_LENT} (${Math.round((t - debut) / n)} ms par image en moyenne) : la vue 3D simple est affichée.`);
          }
        };
        window.setTimeout(() => requestAnimationFrame(compter), 3000);
      };
      const controleur = await creerVuePhoto({
        carte,
        cle: process.env.NEXT_PUBLIC_GOOGLE_TILES_KEY,
        profil,
        surCredits: setCreditsPhoto,
        surMesures: setMesures,
        surHauteurs: (resultat) => {
          hauteursRef.current = resultat;
          placerPins();
          planifierPlacement(200);
        },
        surAffichee: () => {
          window.clearTimeout(delaiChargementRef.current);
          surveillerFluidite();
        },
        surProbleme: (code) => {
          abandon = true;
          retirerPhoto();
          setInfo(code === "limite" ? "Pour limiter les coûts, rechargez la page pour relancer la vue 3D photo." : MESSAGE_REPLI_PHOTO);
        },
      });
      if (abandon) {
        controleur.retirer();
        return;
      }
      photoRef.current = controleur;
      if (MONTRER_MESURES && typeof window !== "undefined") window.__photoCtl = controleur; // outil de diagnostic des aperçus (essais hors ligne), sans effet
      setPhoto("on");
      if (profil.modeste) setInfo("Appareil modeste : la vue photo est allégée (moins de détail) pour rester fluide.");
      // Inclinaison plafonnée selon l'appareil ; les bâtiments gris sont masqués sous la photo.
      carte.setMaxPitch(profil.inclinaisonMax);
      carte.setMaxZoom(profil.zoomMax);
      if (carte.getPitch() > profil.inclinaisonMax || carte.getZoom() > profil.zoomMax) carte.easeTo({ pitch: Math.min(carte.getPitch(), profil.inclinaisonMax), zoom: Math.min(carte.getZoom(), profil.zoomMax), duration: 500 });
      if (batimentsAjoutesRef.current) carte.setLayoutProperty("batiments-3d", "visibility", "none");
      // La session Google dure « au moins 3 heures » : on coupe avant, pour ne jamais travailler avec une session expirée.
      minuterieSessionRef.current = window.setTimeout(() => {
        retirerPhoto();
        setInfo("La session de la vue photo est terminée : appuyez de nouveau sur « Vue 3D photo » pour la relancer.");
      }, DUREE_MAX_VUE_PHOTO_MS);
    } catch (erreur) {
      console.error("[carte 3D photo] démarrage impossible :", erreur?.message || erreur);
      retirerPhoto();
      setInfo(MESSAGE_REPLI_PHOTO);
    }
  };

  const surPhoto = () => lancerPhoto(false);
  const continuerQuandMeme = () => lancerPhoto(true);

  const allerA = (b) => {
    carteRef.current?.flyTo({ center: [b.lng, b.lat], zoom: Math.min(Math.max(carteRef.current.getZoom(), 16), carteRef.current.getMaxZoom()), duration: 900 });
    if (photo !== "on" && carrousel) setPanneau({ boutiques: [b], index: 0 });
  };

  return (
    <div ref={racineRef} className={`fixed inset-0 bg-[#e8eaee]${photo === "on" ? " carte-photo" : ""}`} style={{ zIndex: 50, ...(photo === "on" ? { background: "linear-gradient(to bottom, #aebfd3 0%, #d3dce6 40%, #e3e8ee 100%)" } : {}), ...(basAttribution ? { "--bas-attribution": `${basAttribution}px` } : {}) }}>
      <style>{".maplibregl-ctrl-bottom-right{bottom:var(--bas-attribution,104px) !important}.maplibregl-popup-content{padding:10px 10px 8px !important;border-radius:18px !important}.carte-photo .maplibregl-marker,.carte-photo .maplibregl-popup{z-index:3}.carte-photo .maplibregl-ctrl-bottom-right{display:none}.carte-photo .maplibregl-canvas{opacity:0}"}</style>
      <div ref={conteneurRef} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%" }} aria-label="Carte 3D des boutiques" />
      {photo === "on" && <div ref={conteneurPinsRef} className="absolute inset-0" style={{ pointerEvents: "none", zIndex: 3, overflow: "hidden" }} aria-hidden="false" />}
      {etat === "chargement" && <div className="absolute inset-0 flex items-center justify-center bg-[#e8eaee] text-sm font-bold text-gray-600">Chargement de la carte 3D…</div>}
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
          {/* En-tête identique à « Autour de moi » : recherche, fermeture, rangée de touches */}
          <div data-zone-interdite="1" className="absolute inset-x-0 top-0 flex flex-col gap-2.5 px-3 pt-3" style={{ pointerEvents: "none", zIndex: 40 }}>
            <div className="flex items-center gap-2.5" style={{ pointerEvents: "auto" }}>
              <div className="flex flex-1 items-center gap-2 pl-4 pr-1.5 shadow-xl" style={{ height: 48, borderRadius: 18, backgroundColor: "#EAE3D2" }}>
                <input
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Rechercher un article, une boutique..."
                  aria-label="Rechercher un article ou une boutique"
                  className="min-w-0 flex-1 bg-transparent text-[13.5px] font-bold text-stone-900 placeholder:text-stone-500 focus:outline-none"
                />
                <span className="flex items-center rounded-[14px] px-3.5 text-[13.5px] font-black text-white" style={{ height: 40, backgroundColor: "#10B981" }}>
                  Rechercher
                </span>
              </div>
              <a href={ADRESSE_CARTE_2D} aria-label="Fermer la carte 3D" className="flex h-11 w-11 items-center justify-center rounded-full text-white shadow-xl" style={{ backgroundColor: "rgba(20,24,33,0.78)" }}>
                ✕
              </a>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ pointerEvents: "auto", scrollbarWidth: "none" }}>
              <button type="button" onClick={() => setFiltre("tous")} className={chipEtat(filtre === "tous")}>
                Toutes les boutiques
              </button>
              <button type="button" onClick={() => setFiltre("live")} className={chipEtat(filtre === "live")}>
                En stock (LIVE)
              </button>
              <button type="button" onClick={() => {
                  if (carrousel && photo !== "on") setPanneau(null);
                  setCarrousel((v) => !v);
                }} aria-pressed={carrousel} className={chipEtat(carrousel)}>
                Carrousel
              </button>
              <span className="shrink-0 self-center rounded-full bg-amber-400 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-gray-900">Prototype</span>
            </div>
          </div>
          {/* Bouton 2D / 3D : toujours visible (rond, à droite), il ne change que le rendu de la carte */}
          <button
            type="button"
            data-zone-interdite="1"
            onClick={surBascule}
            aria-pressed={mode3D}
            aria-label={mode3D ? "Passer en 2D" : "Passer en 3D"}
            className="absolute right-3 flex h-14 w-14 flex-col items-center justify-center rounded-full bg-sky-500 text-white shadow-2xl"
            style={{ top: 132, zIndex: 45 }}
          >
            <span className="text-[15px] font-black leading-none">{mode3D ? "3D" : "2D"}</span>
            <span className="mt-0.5 text-[8px] font-extrabold leading-none opacity-90">{mode3D ? "→ 2D" : "→ 3D"}</span>
          </button>
          {/* Vue 3D photo (Google) : prototype derrière l'interrupteur NEXT_PUBLIC_CARTE_3D_PHOTO ; ne charge rien tant qu'on n'appuie pas */}
          {photoPossible && (
            <button
              type="button"
              data-zone-interdite="1"
              onClick={surPhoto}
              disabled={photo === "chargement"}
              aria-pressed={photo === "on"}
              aria-label={photo === "on" ? "Quitter la vue 3D photo" : "Vue 3D photo"}
              className="absolute right-3 flex h-14 w-14 flex-col items-center justify-center rounded-full bg-indigo-600 text-white shadow-2xl disabled:opacity-70"
              style={{ top: 196, zIndex: 45 }}
            >
              <span className="text-[13px] font-black leading-none">{photo === "chargement" ? "…" : "PHOTO"}</span>
              <span className="mt-0.5 text-[8px] font-extrabold leading-none opacity-90">{photo === "on" ? "quitter" : "Google"}</span>
            </button>
          )}
          {/* Mesures de la vue photo (aperçus seulement) : durées depuis l'appui, pour pouvoir les transmettre sans ouvrir la console */}
          {MONTRER_MESURES && mesures && (
            <div className="absolute left-3 rounded-lg bg-black/65 px-2 py-1 text-[10px] font-semibold leading-snug text-white" style={{ top: 132, zIndex: 45, pointerEvents: "none", maxWidth: "68%" }}>
              <div>Racine : {mesures.racineMs == null ? "…" : `${(mesures.racineMs / 1000).toFixed(1)} s (HTTP ${mesures.racineStatut})`}</div>
              <div>1re tuile reçue : {mesures.premiereRecueMs == null ? "—" : `${(mesures.premiereRecueMs / 1000).toFixed(1)} s`}</div>
              <div>1re tuile affichée : {mesures.premiereAfficheeMs == null ? "—" : `${(mesures.premiereAfficheeMs / 1000).toFixed(1)} s`}</div>
              <div>Tuiles chargées : {mesures.tuilesChargees}</div>
              <div>Zoom : {zoomActuel ? `${zoomActuel.zoom} (maximum ${zoomActuel.max})` : "…"}</div>
              <div>Erreur géométrique la plus fine affichée : {mesures.erreurFine == null ? "…" : `${Math.round(mesures.erreurFine * 10) / 10} m`}</div>
              <div>Hauteur du sol lue sous {hauteurCentre ? `« ${hauteurCentre.nom} »` : "l'épingle la plus proche du centre"} : {hauteurCentre ? (hauteurCentre.bas == null ? "non disponible (repli : 0 m)" : `${Math.round(hauteurCentre.bas * 10) / 10} m (ellipsoïde) → épingle à ${Math.round(hauteurCentre.altitude * 10) / 10} m dans la scène, tuile fine ${Math.round(hauteurCentre.ge * 10) / 10} m`) : "…"}</div>
              <div>Dernière erreur : {mesures.derniereErreur || "aucune"}</div>
              <div>Durée moyenne par image : {fluidite ? `${fluidite.moyenneMs} ms (${fluidite.imagesParS} images/s)` : "…"}</div>
              <div>Tuiles : {mesures.tuiles ? `${mesures.tuiles.dansVue} dans la vue · ${mesures.tuiles.aAfficher} à afficher · ${mesures.tuiles.enCours} en cours · ${mesures.tuiles.echecs} échecs` : "…"}</div>
            </div>
          )}
          {/* Bande de boutiques en bas, comme sur la carte 2D */}
          <div data-zone-interdite="1" className={`absolute inset-x-0 ${photo === "on" ? "bottom-0" : "bottom-4"} flex flex-col items-center gap-2 px-3`} style={{ pointerEvents: "none", zIndex: 40, ...(photo === "on" ? { paddingLeft: 0, paddingRight: 0 } : {}) }}>
            {info && (
              <div className="rounded-2xl bg-gray-900/90 px-4 py-2.5 text-center text-xs font-bold text-white shadow-xl" style={{ pointerEvents: "auto" }}>
                {info}
                {info.startsWith(DEBUT_MESSAGE_LENT) && photoPossible && (
                  <button type="button" onClick={continuerQuandMeme} className="mt-2 block w-full rounded-full bg-indigo-500 px-3 py-1.5 text-xs font-black text-white">
                    Continuer quand même
                  </button>
                )}
              </div>
            )}
            {avisPlafond && (
              <div className="rounded-2xl bg-gray-900/90 px-3 py-2 text-center text-[11px] font-bold text-white shadow-xl" style={{ pointerEvents: "auto", maxWidth: "min(94vw, 430px)" }}>
                {avisPlafond}
              </div>
            )}
            {panneau && boutiqueDuPanneau && (
              <div className="relative mx-3 self-start rounded-2xl bg-white p-3 pr-10 shadow-2xl sm:self-center" style={{ pointerEvents: "auto", maxWidth: "min(94vw, 430px)", maxHeight: "42vh", overflowY: "auto" }} role="dialog" ref={dialogueRef} aria-label={`Carrousel : ${boutiqueDuPanneau.nom}`}>
                <button type="button" onClick={() => setPanneau(null)} aria-label="Fermer le carrousel" className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-black text-gray-800">
                  ✕
                </button>
                <div ref={panneauRef} dangerouslySetInnerHTML={{ __html: htmlBulle(boutiqueDuPanneau, largeurCarrousel) }} />
              </div>
            )}
            <div className="flex max-w-full gap-3 overflow-x-auto rounded-full bg-white/70 px-4 py-2 shadow-xl backdrop-blur-md" style={{ pointerEvents: "auto", scrollbarWidth: "none" }}>
              {affichees.map((b) => (
                <button key={b.id} type="button" onClick={() => allerA(b)} className="flex shrink-0 flex-col items-center gap-1" title={b.nom}>
                  <span
                    className="h-11 w-11 overflow-hidden rounded-full border-2 border-white bg-white shadow-md"
                    dangerouslySetInnerHTML={{ __html: contenuAvatar(b, 44) || '<span style="font-size:20px;display:flex;height:100%;align-items:center;justify-content:center">🏪</span>' }}
                  />
                  <span className="max-w-[56px] truncate text-[9px] font-extrabold text-gray-800">{b.nom}</span>
                </button>
              ))}
            </div>
            {/* Attribution exigée par Google : logo officiel « Google Maps » (non modifié, 18 px de haut, marges 10 / 10 / 10 / 5 px) + sources de données des tuiles affichées (une ligne, dépliable). Sous la bande de boutiques : aucun recouvrement. */}
            {photo === "on" && (
              <div className="flex w-full items-start gap-3" style={{ pointerEvents: "auto", padding: "10px 10px 5px 10px" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/carte3d/google-maps-logo.svg" alt="Google Maps" style={{ height: 18, width: "auto", display: "block", flexShrink: 0 }} />
                <button type="button" onClick={() => setCreditsOuverts((v) => !v)} aria-label="Google Maps. Sources de données" className="min-w-0 flex-1 rounded-lg bg-black/60 px-2 py-0.5 text-left text-[10px] font-semibold text-white">
                  <span className={creditsOuverts ? "block" : "block truncate"}>{creditsPhoto || "Sources de données…"}</span>
                  <span className="block text-[9px] font-extrabold underline">{creditsOuverts ? "Réduire ▴" : "Sources de données ▾"}</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
