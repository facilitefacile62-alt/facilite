"use client";
// Carte 3D de Locaux (PROTOTYPE) — même interface que la carte « Autour de moi » : barre de recherche, rangée de touches, bulles Carrousel sur chaque boutique, bande de boutiques en bas.
// SEUL le bouton 2D/3D change le rendu de la carte (volumes et inclinaison, ou carte à plat).
//
// Données : fond OpenFreeMap (style « positron », sans clé) ; bâtiments Overture (voir scripts/carte3d/extraire-batiments.py), fichier statique public/carte3d/batiments.geojson chargé SEULEMENT à la
// première activation de la 3D. Les boutiques sont chargées comme sur la carte 2D (mêmes fonctions publiques) : rien de plus que la carte actuelle, aucune coordonnée dans le HTML.
// Repli : appareil trop faible, WebGL absent, fond injoignable, carte trop lente => retour à la carte 2D actuelle (ou carte à plat).
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ADRESSE_CARTE_2D, DUREE_MAX_VUE_PHOTO_MS, cartePhotoActive, peutAfficher3D, profilPhoto } from "@/lib/carte3d";
import { chargerLogosBoutiques, chargerTousLesArticles, echapperHtml, urlPhoto } from "@/lib/marketplaceData";
import { htmlEpingle } from "@/lib/epingleCarte";
import { svgAvatarBoutique } from "@/lib/avatarBoutique";
import { calculerGroupesPhoto, centreGroupe, cleGroupe } from "@/lib/groupesBoutiques";
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
    if (b.logo_url) return `<img src="${echapperHtml(b.logo_url)}" alt="" style="width:100%;height:100%;object-fit:cover;" />`;
    if (b.avatar_config) return svgAvatarBoutique(b.avatar_config, taille);
  } catch {
    /* repli : pictogramme */
  }
  return null;
}

function elementRepere(b) {
  const boite = document.createElement("div");
  boite.style.cssText = "width:140px;height:90px;cursor:pointer;";
  boite.innerHTML = htmlEpingle({ couleur: "#10B981", type: "produit", nom: echapperHtml(String(b.nom).slice(0, 18)), contenuHtml: contenuAvatar(b, 52) });
  boite.querySelector(".epingle-boite").style.pointerEvents = "auto";
  return boite;
}

// Vue 3D photo : boutiques à 100 m ou moins regroupées sous UNE épingle (chiffre = nombre de boutiques) et UNE bulle Carrousel (articles de toutes les boutiques, pastille de boutique sur chaque carte).
function elementRepereGroupe(groupe) {
  const boite = document.createElement("div");
  boite.style.cssText = "width:140px;height:90px;cursor:pointer;";
  const chiffre = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#047857;color:#fff;font-weight:900;font-size:26px;font-family:system-ui,sans-serif;">${groupe.length}</div>`;
  boite.innerHTML = htmlEpingle({ couleur: "#10B981", type: "produit", nom: `${groupe.length} boutiques`, contenuHtml: chiffre });
  boite.querySelector(".epingle-boite").style.pointerEvents = "auto";
  return boite;
}

function boutiqueDeGroupe(groupe) {
  return {
    nom: groupe.map((b) => b.nom).join(", "),
    quartier: `${groupe.length} boutiques · ${groupe[0].quartier}`,
    articles: groupe.flatMap((b) => b.articles.slice(0, 4).map((a) => ({ ...a, __badge: contenuAvatar(b, 22) || "🏪" }))),
  };
}

// Bulle « Carrousel » d'une boutique : nom, quartier, deux articles visibles à la fois, flèches gauche / droite.
function htmlBulle(b, largeur = 140) {
  const cartes = b.articles
    .slice(0, 12)
    .map((a) => {
      const photo = a.photos?.[0] ? urlPhoto(a.photos[0]) : "";
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
  const hauteursRef = useRef(new Map()); // clé d'épingle -> { bas, altitude, ge } : hauteur du sol lue sous l'épingle (vue photo)
  const conteneurPinsRef = useRef(null); // calque des épingles de la vue photo (positionnées image par image à leur hauteur)
  const entreesPinsRef = useRef([]); // [{ cle, el, lat, lng, nom }]
  const dernierCentreRef = useRef(0);
  const [hauteurCentre, setHauteurCentre] = useState(null); // zone de mesures : hauteur lue pour l'épingle la plus proche du centre de l'écran
  const reperesRef = useRef(new Map()); // clé de groupe -> élément de l'épingle (pour la mettre au premier plan)
  const [groupesPhoto, setGroupesPhoto] = useState(null); // { sig, items } : groupes selon le zoom, vue photo seulement
  const [zoomActuel, setZoomActuel] = useState(null); // zoom de la carte en vue photo (zone de mesures des aperçus)
  const [fluidite, setFluidite] = useState(null); // { moyenneMs, imagesParS } : affiché seulement avec ?photo=sans-coupure
  const mode3DRef = useRef(true);
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
    const points = entrees.map((e) => [e.lng, e.lat, hauteursRef.current.get(e.cle)?.altitude ?? 0]);
    const pixels = ctl.projeter(points);
    const cx = conteneur.clientWidth / 2;
    const cy = conteneur.clientHeight / 2;
    let plusProche = null;
    entrees.forEach((e, i) => {
      const [x, y] = pixels[i];
      e.el.style.transform = `translate(${Math.round((x - 70) * 10) / 10}px, ${Math.round((y - 85) * 10) / 10}px)`;
      e.el.style.visibility = "visible";
      const d = Math.hypot(x - cx, y - cy);
      if (plusProche === null || d < plusProche.d) plusProche = { d, e };
    });
    // Mesure affichée (aperçus) : au plus une fois par seconde.
    const maintenant = Date.now();
    if (MONTRER_MESURES && plusProche && maintenant - dernierCentreRef.current > 1000) {
      dernierCentreRef.current = maintenant;
      const lue = hauteursRef.current.get(plusProche.e.cle) || null;
      setHauteurCentre({ nom: plusProche.e.nom, bas: lue?.bas ?? null, altitude: lue?.altitude ?? null, ge: lue?.ge ?? null });
    }
  }, []);
  useEffect(() => {
    const carte = carteRef.current;
    if (photo !== "on" || !carte) return undefined;
    carte.on("render", placerPins);
    return () => carte.off("render", placerPins);
  }, [photo, placerPins]);

  // Vue photo : groupes recalculés selon le ZOOM (distance en pixels). On ne remplace l'état que si la composition change : les épingles ne sont pas recréées à chaque cran de zoom.
  useEffect(() => {
    const carte = carteRef.current;
    if (photo !== "on" || !carte) return undefined;
    const recalculer = () => setGroupesPhoto((prec) => {
      const suivant = calculerGroupesPhoto(affichees, carte.getZoom());
      return prec && prec.sig === suivant.sig ? prec : suivant;
    });
    recalculer();
    carte.on("zoomend", recalculer);
    return () => carte.off("zoomend", recalculer);
  }, [photo, affichees]);
  const groupesActifs = photo === "on" ? groupesPhoto : null;
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

  // Repères + bulles : recréés quand la liste affichée change ; les bulles sont ouvertes d'office (touche « Carrousel » active).
  useEffect(() => {
    const carte = carteRef.current;
    const ml = bibliothequeRef.current;
    if (!carte || !ml || etat !== "pret") return undefined;
    // Vue grise : une épingle par boutique avec sa bulle, comme avant. Vue photo : groupes selon le zoom (chiffre = nombre de boutiques) ; PAS de bulle sur la carte : le carrousel s'affiche dans un panneau fixe en bas.
    const enPhoto = Boolean(groupesActifs);
    const unites = enPhoto ? groupesActifs.items.map((it) => ({ membres: it.membres, centre: centreGroupe(it.membres) })) : affichees.map((b) => ({ membres: [b], centre: b }));
    reperesRef.current = new Map();
    entreesPinsRef.current = [];
    const crees = unites.map(({ membres: groupe, centre }) => {
      const groupee = groupe.length > 1;
      const el = groupee ? elementRepereGroupe(groupe) : elementRepere(groupe[0]);
      if (enPhoto && conteneurPinsRef.current) {
        // Vue photo : élément simple dans le calque (positionné image par image par placerPins), pas de repère MapLibre.
        const cle = cleGroupe(groupe);
        el.style.cssText += "position:absolute;left:0;top:0;visibility:hidden;pointer-events:auto;will-change:transform;";
        conteneurPinsRef.current.appendChild(el);
        reperesRef.current.set(cle, el);
        entreesPinsRef.current.push({ cle, el, lat: centre.lat, lng: centre.lng, nom: groupee ? `${groupe.length} boutiques` : groupe[0].nom });
        el.addEventListener("click", (ev) => {
          ev.stopPropagation(); // le clic sur une épingle ne doit pas fermer le panneau (clic sur la carte)
          setPanneau({ boutiques: groupe, index: 0 });
          // Un clic sur une épingle de groupe zoome aussi sur le groupe (aucune requête réseau : la carte et la photo se déplacent seulement).
          const zoomCible = Math.min(carte.getZoom() + 2.2, carte.getMaxZoom());
          if (groupee && zoomCible > carte.getZoom() + 0.05) carte.easeTo({ center: [centre.lng, centre.lat], zoom: zoomCible, duration: 700 });
        });
        return { marqueur: { remove: () => el.remove() }, popup: null };
      }
      const marqueur = new ml.Marker({ element: el, anchor: "top-left", offset: [-70, -85] }).setLngLat([centre.lng, centre.lat]).addTo(carte);
      // Vue grise : PLUS de bulles sur la carte (elles s'empilaient et montaient sous la recherche). Le carrousel de la boutique touchée s'ouvre dans le même panneau fixe qu'en vue photo (un seul à la fois,
      // au-dessus de la bande de boutiques) ; l'épingle touchée passe devant les autres. Touche « Carrousel » éteinte : les épingles n'ouvrent rien.
      reperesRef.current.set(cleGroupe(groupe), el);
      el.addEventListener("click", (ev) => {
        ev.stopPropagation(); // le clic sur une épingle ne doit pas fermer le panneau (clic sur la carte)
        if (carrousel) setPanneau({ boutiques: groupe, index: 0 });
      });
      return { marqueur, popup: null };
    });
    if (enPhoto && photoRef.current) {
      photoRef.current.definirLieux(entreesPinsRef.current.map((e) => ({ id: e.cle, lat: e.lat, lng: e.lng })));
      placerPins();
    }
    return () => {
      crees.forEach((r) => {
        r.marqueur.remove();
      });
    };
  }, [affichees, carrousel, etat, groupesActifs, placerPins]);

  // Vue photo : l'épingle choisie passe devant les autres (même si deux épingles se chevauchent) et le carrousel reste dans le panneau fixe ; un clic sur la carte ferme le panneau.
  useEffect(() => {
    const cleChoisie = panneau ? cleGroupe(panneau.boutiques) : null;
    reperesRef.current.forEach((el, cle) => {
      el.style.zIndex = cle === cleChoisie ? "10" : "";
    });
  }, [panneau, groupesActifs, affichees]);
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
    <div className={`fixed inset-0 bg-[#e8eaee]${photo === "on" ? " carte-photo" : ""}`} style={{ zIndex: 50, ...(photo === "on" ? { background: "linear-gradient(to bottom, #aebfd3 0%, #d3dce6 40%, #e3e8ee 100%)" } : {}), ...(basAttribution ? { "--bas-attribution": `${basAttribution}px` } : {}) }}>
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
          <div className="absolute inset-x-0 top-0 flex flex-col gap-2.5 px-3 pt-3" style={{ pointerEvents: "none", zIndex: 40 }}>
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
          <div className={`absolute inset-x-0 ${photo === "on" ? "bottom-0" : "bottom-4"} flex flex-col items-center gap-2 px-3`} style={{ pointerEvents: "none", zIndex: 40, ...(photo === "on" ? { paddingLeft: 0, paddingRight: 0 } : {}) }}>
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
            {panneau && boutiqueDuPanneau && (
              <div className="relative mx-3 self-start rounded-2xl bg-white p-3 pr-10 shadow-2xl sm:self-center" style={{ pointerEvents: "auto", maxWidth: "min(94vw, 430px)", maxHeight: "42vh", overflowY: "auto" }} role="dialog" ref={dialogueRef} aria-label={`Carrousel : ${boutiqueDuPanneau.nom}`}>
                <button type="button" onClick={() => setPanneau(null)} aria-label="Fermer le carrousel" className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-black text-gray-800">
                  ✕
                </button>
                {panneau.boutiques.length > 1 && (
                  <div className="mb-2 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                    {panneau.boutiques.map((b, k) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setPanneau({ boutiques: panneau.boutiques, index: k })}
                        aria-pressed={k === panneau.index}
                        className={`flex shrink-0 items-center gap-1.5 rounded-full border-2 px-2 py-1 text-[11px] font-extrabold ${k === panneau.index ? "border-emerald-500 bg-emerald-50 text-gray-900" : "border-gray-200 bg-white text-gray-600"}`}
                      >
                        <span className="h-6 w-6 overflow-hidden rounded-full bg-white" dangerouslySetInnerHTML={{ __html: contenuAvatar(b, 24) || "🏪" }} />
                        <span className="max-w-[110px] truncate">{b.nom}</span>
                      </button>
                    ))}
                  </div>
                )}
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
