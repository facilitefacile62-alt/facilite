"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import "leaflet/dist/leaflet.css";
import {
  echapperHtml,
  positionActuelle,
  obtenirHorairesBoutique,
  calculerStatutOuverture,
  obtenirDateHeureDakar,
  JOURS_SEMAINE,
} from "@/lib/marketplaceData";
import { brancherEchelleZoomAvatars, dataUriAvatarBoutique, svgAvatarBoutique } from "@/lib/avatarBoutique";

// Les styles Carto Dark Matter / Voyager sont retirés : Carto a fermé l'accès
// anonyme à ces tuiles (elles renvoient un placeholder "API KEY REQUIRED" en
// HTTP 200 — un vrai succès réseau mais une image inutilisable, donc invisible
// pour errorTileUrl qui ne réagit qu'aux échecs de requête). OpenStreetMap
// (déjà dans la CSP, déjà utilisé ici comme repli) sert maintenant les styles
// "dark" et "voyager" ; le rendu sombre est simulé par un filtre CSS
// appliqué uniquement au pane des tuiles (voir plus bas), pas par une tuile
// pré-assombrie. Satellite (ArcGIS) n'est pas concerné, inchangé.
const TUILES_SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
// Sous-domaine {s} indispensable : la CSP n'autorise que
// "https://*.tile.openstreetmap.org" (voir next.config.mjs), qui ne
// matche pas le domaine nu "tile.openstreetmap.org" — même convention
// que CarteBoutiques.jsx, qui utilise déjà ce schéma avec succès.
const TUILES_OSM = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const FILTRE_TUILES_SOMBRE = "invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9)";

const CENTRE_SENEGAL = [14.6937, -17.4441]; // [lat, lng] Dakar / Thiès

// Un seul pin par boutique quel que soit son type_boutique — l'icône varie,
// jamais le nombre de pins (une boutique service/établissement n'a par
// construction aucun article, donc aucune multiplication possible).
const COULEUR_SERVICE = "#F59E0B";
const COULEUR_ETABLISSEMENT = "#8B5CF6";
const EMOJI_CATEGORIE_ETABLISSEMENT = {
  sante: "🏥",
  finance: "🏦",
  beaute: "💇🏾",
  autre: "🏢",
};
const LIBELLES_CATEGORIE_ETABLISSEMENT = {
  sante: "Santé",
  finance: "Finance",
  beaute: "Beauté",
  autre: "Établissement",
};

// Avatars de démonstration pour commerçants / candidats
const AVATARS_SNAP = [
  { id: "1", emoji: "👩🏾‍🦱", label: "Mode & Tendance" },
  { id: "2", emoji: "👨🏾‍💼", label: "Tech & Pro" },
  { id: "3", emoji: "👩🏾‍💼", label: "Beauté & Soins" },
  { id: "4", emoji: "🧑🏾‍💻", label: "Électronique" },
  { id: "5", emoji: "🧕🏾", label: "Maison & Déco" },
  { id: "6", emoji: "🧢", label: "Sport & Style" },
];

function urlPhoto(chemin) {
  if (!chemin) return "";
  if (chemin.startsWith("http://") || chemin.startsWith("https://")) return chemin;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kdtamtwbvogvuzkknbcu.supabase.co";
  return `${base}/storage/v1/object/public/marketplace/${chemin}`;
}

function prixLisible(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("fr-FR");
}

export default function GlobeExplorateurBoutiques({
  boutiques = [],
  tousArticles = [],
  onVoirBoutique,
  onVoirArticle,
  onFermer,
  // Position déjà relevée par le bouton "Autour de moi" du Marketplace
  // (avant même l'ouverture du Globe) : évite de redemander la permission
  // de géolocalisation une seconde fois quand ce composant remplace
  // désormais aussi la carte "Autour de moi" mobile.
  positionInitiale = null,
}) {
  const conteneurRef = useRef(null);
  const carteRef = useRef(null);
  const coucheTuilesRef = useRef(null);
  const groupeMarqueursRef = useRef(null);
  const marqueurMoiRef = useRef(null);
  const echelleZoomCleanupRef = useRef(null);
  // Cadre de sélection déplaçable/redimensionnable ("voir toutes les
  // boutiques d'une zone") — même outil que sur la carte compacte
  // CarteBoutiques.jsx (demande explicite de l'utilisateur), porté ici
  // pour la vue plein écran Explorer.
  const dragEtatRef = useRef(null);
  // Toujours la dernière version de rafraichirMarqueurs (assigné à chaque
  // rendu, voir plus bas) — permet à l'effet d'initialisation de la carte
  // de dessiner les marqueurs directement dès que SA PROPRE carte est
  // prête, sans dépendre de l'effet réactif [rafraichirMarqueurs,
  // cartePrete] qui s'est avéré capable de rater sa fenêtre : entre la
  // destruction de l'ancienne carte et la création de la nouvelle,
  // carteRef.current passe par un état transitoire (null, ou incohérent
  // avec groupeMarqueursRef.current) pendant lequel cet effet réactif peut
  // se déclencher et abandonner silencieusement, sans être ensuite
  // regaranti de se redéclencher une fois la nouvelle carte réellement
  // prête (reproduit de façon fiable en local : les marqueurs restaient
  // absents après un rechargement de page avec Explorer restauré depuis
  // l'URL, alors que carte et données étaient toutes deux correctes).
  const rafraichirMarqueursRef = useRef(() => {});
  // Même raisonnement que rafraichirMarqueursRef ci-dessus, pour le
  // marqueur "Vous êtes ici" : l'effet réactif [positionInitiale,
  // cartePrete] plus bas peut rater la même fenêtre transitoire.
  const centrerSurPositionRef = useRef(() => {});

  const [boutiqueSelectionnee, setBoutiqueSelectionnee] = useState(null);
  const [filtreActif, setFiltreActif] = useState("tous"); // 'tous' | 'populaires' | 'live'
  const [styleActif, setStyleActif] = useState("dark"); // 'dark' (Défaut Dark Mapbox) | 'voyager' | 'satellite'
  const [localisationEnCours, setLocalisationEnCours] = useState(false);
  const [erreurLocalisation, setErreurLocalisation] = useState("");
  const [vueBoutiqueDetails, setVueBoutiqueDetails] = useState(false);
  const [cartePrete, setCartePrete] = useState(false);
  const [horaires, setHoraires] = useState([]);
  const [horairesChargement, setHorairesChargement] = useState(false);
  // Recherche mot-clé de la carte (Point C) — filtre local, sur les
  // boutiques/articles déjà chargés par le Marketplace (aucun nouvel appel
  // réseau) : cherche un article ou une boutique, jamais bloquant.
  const [rechercheCarte, setRechercheCarte] = useState("");
  const [scanPhotoEnCours, setScanPhotoEnCours] = useState(false);
  const inputRechercheRef = useRef(null);
  const fileInputPhotoRef = useRef(null);

  // Recherche par photo (IA Scanner Vision)
  const handleScanPhotoRecherche = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanPhotoEnCours(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/marketplace/scan-product", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const titreDetecte = data?.fiche?.titre || data?.titre || "";
        if (titreDetecte) {
          setRechercheCarte(titreDetecte);
        } else {
          const fallback = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim();
          setRechercheCarte(fallback || "article");
        }
      } else {
        const fallback = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim();
        setRechercheCarte(fallback || "article");
      }
    } catch (err) {
      console.warn("Erreur recherche par image:", err);
      const fallback = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim();
      setRechercheCarte(fallback || "article");
    } finally {
      setScanPhotoEnCours(false);
      if (fileInputPhotoRef.current) {
        fileInputPhotoRef.current.value = "";
      }
    }
  };

  // Bascule d'affichage du dock inférieur : liste de boutiques (existante)
  // ou nouvelle liste d'articles individuels (Point C) — deux vues
  // distinctes dans le même espace, pas de carrousel supplémentaire empilé.
  const [vueCarrousel, setVueCarrousel] = useState("boutiques"); // 'boutiques' | 'articles'

  // Filtrer les boutiques avec coordonnées valides
  const marqueurs = useMemo(() => {
    return boutiques.filter(
      (b) => Number.isFinite(b.lat) && Number.isFinite(b.lng) && (b.lat !== 0 || b.lng !== 0)
    );
  }, [boutiques]);

  const rechercheNormalisee = rechercheCarte.trim().toLowerCase();

  // Articles correspondant à la recherche (Point C) — filtre local sur
  // tousArticles, déjà chargé par le Marketplace (même tableau que
  // "resultats", aucun nouvel appel réseau). Sert à la fois à la nouvelle
  // liste d'articles du dock ET à révéler sur la carte les boutiques qui
  // vendent un article correspondant : "Mode Loupe" (révéler au zoom les
  // boutiques vendant un article) et "Synchronisation recherche → carte"
  // n'ont jamais été spécifiés comme deux interactions distinctes (aucune
  // trace dans le code, les migrations, le handoff design ni les plans
  // existants au 12/09/2026) — un seul mécanisme couvre les deux besoins :
  // taper/sélectionner un article filtre et recentre la carte sur ses
  // boutiques, sans geste de zoom inventé séparément.
  const articlesFiltres = useMemo(() => {
    if (!rechercheNormalisee) return tousArticles;
    return tousArticles.filter(
      (a) =>
        (a.titre || "").toLowerCase().includes(rechercheNormalisee) ||
        (a.categorie || "").toLowerCase().includes(rechercheNormalisee) ||
        (a.boutique_nom || "").toLowerCase().includes(rechercheNormalisee)
    );
  }, [tousArticles, rechercheNormalisee]);

  const idsBoutiquesArticlesFiltres = useMemo(
    () => new Set(articlesFiltres.map((a) => a.boutique_id).filter(Boolean)),
    [articlesFiltres]
  );

  // Boutiques filtrées selon l'onglet, puis selon la recherche (Point C) —
  // une boutique reste affichée si son nom correspond, OU si elle vend au
  // moins un article qui correspond (idsBoutiquesArticlesFiltres). Sans
  // recherche active, comportement strictement identique à avant.
  const boutiquesAffichees = useMemo(() => {
    let base;
    if (filtreActif === "live") {
      base = marqueurs.filter(
        (b) => b.statut === "en_stock" || (b.articles && b.articles.some((a) => a.statut === "en_stock"))
      );
    } else if (filtreActif === "populaires") {
      base = marqueurs.slice(0, Math.max(3, Math.ceil(marqueurs.length / 2)));
    } else {
      base = marqueurs;
    }
    if (!rechercheNormalisee) return base;
    return base.filter(
      (b) => (b.nom || "").toLowerCase().includes(rechercheNormalisee) || idsBoutiquesArticlesFiltres.has(b.id)
    );
  }, [marqueurs, filtreActif, rechercheNormalisee, idsBoutiquesArticlesFiltres]);

  // Tous les points affichés (boutiques + "Vous êtes ici" si placé) — sert
  // à la fois à détecter les marqueurs superposés au clic et au cadre de
  // sélection ci-dessous. Lit la position de "Vous êtes ici" directement
  // sur son marqueur Leaflet (pas de state dédié pour ça ici).
  const obtenirMembresConnus = useCallback(() => {
    const membres = boutiquesAffichees.map((b) => ({
      position: [b.lat, b.lng],
      type: "boutique",
      id: b.id,
      nom: b.nom || "Boutique",
      avatarConfig: b.avatar_config,
      photo: b.photo ? urlPhoto(b.photo) : null,
    }));
    const ici = marqueurMoiRef.current?.getLatLng();
    if (ici) membres.push({ position: [ici.lat, ici.lng], type: "ici" });
    return membres;
  }, [boutiquesAffichees]);

  // Popup listant plusieurs lieux à choisir — même mécanisme que
  // CarteBoutiques.jsx : clic sur des marqueurs superposés, ou validation
  // du cadre de sélection.
  const ouvrirListeCluster = useCallback(
    async (position, membres) => {
      const carte = carteRef.current;
      if (!carte || membres.length === 0) return;
      const L = (await import("leaflet")).default;
      // Carrousel d'avatars (même présentation que le dock du bas, voir
      // vueCarrousel "boutiques" plus bas) plutôt qu'une simple liste de
      // texte — demande explicite de l'utilisateur.
      const html = `
        <div style="padding:2px 0;">
          <div style="font-size:10px;font-weight:900;color:#fff;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.02em;">${membres.length} lieu${membres.length > 1 ? "x" : ""} à cet endroit</div>
          <div style="display:flex;gap:10px;overflow-x:auto;max-width:260px;">
            ${membres
              .map((m, i) => {
                const avatarUri = m.type === "boutique" && m.avatarConfig ? dataUriAvatarBoutique(m.avatarConfig, 44) : null;
                const bordure = m.type === "ici" ? "linear-gradient(135deg,#38bdf8,#2563eb)" : "linear-gradient(135deg,#10B981,#34d399)";
                const contenu = m.type === "ici"
                  ? `<span style="font-size:20px;">🧑🏾</span>`
                  : avatarUri
                  ? `<img src="${avatarUri}" style="width:100%;height:100%;object-fit:cover;" />`
                  : m.photo
                  ? `<img src="${m.photo}" style="width:100%;height:100%;object-fit:cover;" />`
                  : `<span style="font-size:20px;">📍</span>`;
                return `
              <button type="button" data-cluster-index="${i}" style="all:unset;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0;width:56px;">
                <div style="width:44px;height:44px;border-radius:9999px;padding:2px;background:${bordure};">
                  <div style="width:100%;height:100%;border-radius:9999px;overflow:hidden;background:#111827;display:flex;align-items:center;justify-content:center;">
                    ${contenu}
                  </div>
                </div>
                <span style="font-size:9px;font-weight:800;color:#fff;max-width:56px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.type === "ici" ? "Vous êtes ici" : echapperHtml(m.nom)}</span>
              </button>`;
              })
              .join("")}
          </div>
        </div>
      `;
      const popup = L.popup({ className: "carte-boutique-bulle-custom", closeButton: true, offset: [0, -10] })
        .setLatLng(position)
        .setContent(html)
        .openOn(carte);
      setTimeout(() => {
        const el = popup.getElement();
        if (!el) return;
        el.querySelectorAll("[data-cluster-index]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const m = membres[Number(btn.getAttribute("data-cluster-index"))];
            carte.closePopup(popup);
            if (m.type === "ici") {
              carte.flyTo(m.position, Math.min(carte.getZoom() + 3, 17), { duration: 0.6 });
            } else {
              const b = boutiquesAffichees.find((x) => x.id === m.id);
              if (b) {
                setBoutiqueSelectionnee(b);
                setVueBoutiqueDetails(true);
                carte.flyTo([b.lat, b.lng], 15.5, { duration: 1.1 });
              }
            }
          });
        });
      }, 0);
    },
    [boutiquesAffichees]
  );

  // Deux marqueurs superposés à l'écran (même position réelle, fréquent :
  // position de démo = position de sa propre boutique) : le premier clic
  // zoome pour les séparer (comme Google Maps) ; passé un certain niveau,
  // aucun zoom ne les sépare jamais, une petite liste remplace le zoom.
  // Signalé par l'utilisateur, déjà corrigé sur CarteBoutiques.jsx.
  const gererClicPointCluster = useCallback(
    (position, actionSiSepare) => {
      const carte = carteRef.current;
      if (!carte) {
        actionSiSepare();
        return;
      }
      const SEUIL_CLUSTER_PX = 26;
      const p1 = carte.latLngToContainerPoint(position);
      const membres = obtenirMembresConnus().filter((m) => {
        const p2 = carte.latLngToContainerPoint(m.position);
        return Math.hypot(p1.x - p2.x, p1.y - p2.y) < SEUIL_CLUSTER_PX;
      });
      if (membres.length <= 1) {
        actionSiSepare();
        return;
      }
      const zoomActuel = carte.getZoom();
      if (zoomActuel >= 17) {
        ouvrirListeCluster(position, membres);
      } else {
        carte.flyTo(position, Math.min(zoomActuel + 4, 18), { duration: 0.6 });
      }
    },
    [obtenirMembresConnus, ouvrirListeCluster]
  );

  // Cadre de sélection : état + déplacement/redimensionnement par pointeur.
  const [modeSelectionActif, setModeSelectionActif] = useState(false);
  const [cadre, setCadre] = useState({ x: 90, y: 90, largeur: 180, hauteur: 180 });

  const gererPointerDownDeplacer = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragEtatRef.current = { type: "deplacer", depart: { x: e.clientX, y: e.clientY }, cadreDepart: { ...cadre } };
  };
  const gererPointerDownRedimensionner = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragEtatRef.current = { type: "redimensionner", depart: { x: e.clientX, y: e.clientY }, cadreDepart: { ...cadre } };
  };

  useEffect(() => {
    if (!modeSelectionActif) return;
    function onMove(e) {
      if (!dragEtatRef.current) return;
      const { type, depart, cadreDepart } = dragEtatRef.current;
      const dx = e.clientX - depart.x;
      const dy = e.clientY - depart.y;
      if (type === "deplacer") {
        setCadre({ ...cadreDepart, x: cadreDepart.x + dx, y: cadreDepart.y + dy });
      } else {
        setCadre({
          ...cadreDepart,
          largeur: Math.max(70, cadreDepart.largeur + dx),
          hauteur: Math.max(70, cadreDepart.hauteur + dy),
        });
      }
    }
    function onUp() {
      dragEtatRef.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [modeSelectionActif]);

  const voirBoutiquesDansLeCadre = useCallback(async () => {
    const carte = carteRef.current;
    if (!carte) return;
    const L = (await import("leaflet")).default;
    const coinHautGauche = carte.containerPointToLatLng([cadre.x, cadre.y]);
    const coinBasDroit = carte.containerPointToLatLng([cadre.x + cadre.largeur, cadre.y + cadre.hauteur]);
    const zone = L.latLngBounds(coinHautGauche, coinBasDroit);
    const membres = obtenirMembresConnus().filter((m) => zone.contains(m.position));
    if (membres.length === 0) return;
    setModeSelectionActif(false);
    ouvrirListeCluster(zone.getCenter(), membres);
  }, [cadre, obtenirMembresConnus, ouvrirListeCluster]);

  // 1. Initialisation Leaflet robuste & garantie zéro écran blanc
  useEffect(() => {
    let annule = false;
    let observer = null;
    const timers = [];
    // Déclarée ici (portée de l'effet) plutôt qu'en `const` dans le bloc
    // async ci-dessous : le nettoyage doit retirer l'écouteur "resize" avec
    // la MÊME référence de fonction que celle passée à addEventListener,
    // ce qui suppose qu'il puisse y accéder.
    let forcerTaille = null;

    // Cet effet DÉTRUIT ET RECRÉE toute la carte à chaque changement de
    // styleActif (bouton satellite/sombre/clair) ou de marqueurs (les
    // boutiques arrivent après l'ouverture du Globe, ex. restauration
    // d'URL au rechargement — voir Marketplace). Sans remettre cartePrete
    // à false ici, il restait déjà à true depuis la carte précédente : les
    // futurs setCartePrete(true) plus bas (une fois la NOUVELLE carte
    // prête) ne changent alors rien pour React (même valeur, aucun
    // re-rendu), donc les effets qui dépendent de cartePrete pour
    // (re)dessiner les marqueurs et repositionner "Vous êtes ici" (lignes
    // ~326 et ~413) ne se redéclenchaient jamais sur la carte fraîchement
    // recréée — d'où boutiques et position disparues au changement de
    // style ou après un rechargement de page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCartePrete(false);

    (async () => {
      if (!conteneurRef.current) return;
      try {
        const L = (await import("leaflet")).default;
        if (annule || !conteneurRef.current) return;

        // Détruire ancienne carte si existante
        if (carteRef.current) {
          carteRef.current.remove();
          carteRef.current = null;
        }

        const centreInitial = marqueurs[0]
          ? [marqueurs[0].lat, marqueurs[0].lng]
          : CENTRE_SENEGAL;

        const carte = L.map(conteneurRef.current, {
          center: centreInitial,
          zoom: 13,
          zoomControl: false,
          attributionControl: false,
          preferCanvas: true,
        });

        carteRef.current = carte;

        // URL de tuiles propre sans paramètre erroné
        const urlTuiles = styleActif === "satellite" ? TUILES_SATELLITE : TUILES_OSM;

        const couche = L.tileLayer(urlTuiles, {
          maxZoom: 19,
          crossOrigin: true,
        }).addTo(carte);

        coucheTuilesRef.current = couche;
        groupeMarqueursRef.current = L.layerGroup().addTo(carte);

        // Rendu "sombre" simulé par filtre CSS sur le seul pane des tuiles
        // (getPane("tilePane") renvoie le conteneur DOM des images raster,
        // séparé du markerPane qui héberge les avatars/divIcon — donc les
        // pins restent intacts par construction, sans sélecteur CSS global
        // qui risquerait d'affecter d'autres cartes Leaflet du site).
        const paneTuiles = carte.getPane("tilePane");
        if (paneTuiles) {
          paneTuiles.style.filter = styleActif === "dark" ? FILTRE_TUILES_SOMBRE : "";
        }

        // Forcer le rafraîchissement des dimensions à plusieurs intervalles.
        // Dessine aussi les marqueurs directement ici (via la ref vers la
        // dernière version de rafraichirMarqueurs) plutôt que de compter
        // uniquement sur l'effet réactif [rafraichirMarqueurs, cartePrete]
        // plus bas : cette carte (`carte`, capturée par fermeture) est
        // garantie d'être la carte ACTUELLE à cet instant précis — `carte
        // === carteRef.current` un peu plus bas l'assure — alors que
        // l'effet réactif peut se déclencher pendant la fenêtre transitoire
        // où l'ancienne carte vient d'être détruite et la nouvelle pas
        // encore prête, y voir un état incohérent, abandonner, et ne pas
        // être regaranti de se redéclencher ensuite.
        forcerTaille = () => {
          if (carteRef.current === carte) {
            carte.invalidateSize({ pan: false });
            setCartePrete(true);
            rafraichirMarqueursRef.current();
            if (positionInitiale) {
              centrerSurPositionRef.current(positionInitiale, { animer: false });
            }
          }
        };

        [50, 150, 300, 600, 1200].forEach((ms) => {
          const t = setTimeout(forcerTaille, ms);
          timers.push(t);
        });

        if (typeof ResizeObserver !== "undefined" && conteneurRef.current) {
          observer = new ResizeObserver(() => {
            forcerTaille();
          });
          observer.observe(conteneurRef.current);
        }

        window.addEventListener("resize", forcerTaille);
      } catch (err) {
        console.error("Erreur initialisation Leaflet:", err);
      }
    })();

    return () => {
      annule = true;
      timers.forEach(clearTimeout);
      if (observer) observer.disconnect();
      // removeEventListener exige la MÊME référence de fonction que celle
      // passée à addEventListener — une nouvelle arrow function ici ne
      // retire rien : l'ancien écouteur "resize" restait accumulé à chaque
      // ré-exécution de l'effet (changement de styleActif/marqueurs) ou
      // fermeture/réouverture du globe. Confirmé lors d'un audit du
      // Marketplace le 2026-09-08.
      if (forcerTaille) window.removeEventListener("resize", forcerTaille);
      if (carteRef.current) {
        carteRef.current.remove();
        carteRef.current = null;
      }
      // Ne pas laisser une référence vers un layerGroup/marqueur détruit
      // avec la carte : sans ça, une fenêtre transitoire existe où
      // carteRef.current est déjà null mais groupeMarqueursRef.current
      // pointe encore vers l'ancien groupe, ce qui peut faire paraître
      // cohérent un état qui ne l'est pas pour tout code lisant les deux.
      groupeMarqueursRef.current = null;
      coucheTuilesRef.current = null;
      marqueurMoiRef.current = null;
    };
    // positionInitiale est lu (via forcerTaille) mais volontairement absent
    // des dépendances : la carte ne doit se recréer que sur un changement
    // de styleActif/marqueurs, jamais parce que la position a changé — ce
    // serait précisément l'instabilité que ce correctif élimine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleActif, marqueurs]);

  // 2. Rendu des Marqueurs Snap Map (Bordure Vert Menthe #10B981 ou Bleu Roi #2563EB)
  const rafraichirMarqueurs = useCallback(async () => {
    const carte = carteRef.current;
    const groupe = groupeMarqueursRef.current;
    if (!carte || !groupe) return;

    const L = (await import("leaflet")).default;
    groupe.clearLayers();

    boutiquesAffichees.forEach((b, idx) => {
      const avatarInfo = AVATARS_SNAP[idx % AVATARS_SNAP.length];
      const aPhoto = b.photo ? urlPhoto(b.photo) : null;
      // Échappés dès ici : injectés plus bas en HTML brut (L.divIcon({ html
      // })), y compris dans un attribut alt="..." — un nom de boutique
      // contenant des guillemets ou des balises casserait sinon hors de
      // l'attribut et s'exécuterait dans le navigateur de tout acheteur
      // ouvrant le globe (faille XSS stockée, atteignable en libre-service).
      const nomCourt = echapperHtml(b.nom || "Boutique Facilité");
      const quartier = echapperHtml(b.quartier || b.ville || "Dakar");
      const estCertifie = Boolean(b.estCertifie || idx % 2 === 0);
      const estActif = b.statut === "en_stock" || (b.articles && b.articles.length > 0);
      const estSelectionne = boutiqueSelectionnee?.id === b.id;
      const typeBoutique = b.type_boutique || "produit";

      // Couleur de bordure et contenu de l'avatar selon le type : produit
      // garde le rendu photo/emoji existant (Vert Menthe #10B981 si actif,
      // Bleu Roi #2563EB si certifié) ; service/établissement ont leur
      // propre couleur fixe et une icône dédiée — "en stock" et "certifié"
      // n'ont pas de sens pour eux (zéro article par construction).
      let bordureCouleur;
      let contenuAvatar;
      let badgeLive = "";
      let pointStatutTooltip = estActif ? "bg-[#10B981] animate-pulse" : "bg-gray-400";
      // Avatar façon Bitmoji en priorité, quel que soit le type_boutique :
      // seule la couleur de bordure reste liée au type. SVG DiceBear généré
      // en local et inliné directement — aucune URL externe.
      const avatarBitmoji = b.avatar_config ? svgAvatarBoutique(b.avatar_config, 52) : null;
      if (typeBoutique === "service") {
        bordureCouleur = COULEUR_SERVICE;
        contenuAvatar = avatarBitmoji || `<span class="text-2xl">🔧</span>`;
      } else if (typeBoutique === "etablissement") {
        bordureCouleur = COULEUR_ETABLISSEMENT;
        contenuAvatar = avatarBitmoji || `<span class="text-2xl">${EMOJI_CATEGORIE_ETABLISSEMENT[b.categorie_etablissement] || "🏢"}</span>`;
      } else {
        bordureCouleur = estCertifie ? "#2563EB" : "#10B981";
        contenuAvatar =
          avatarBitmoji ||
          (aPhoto
            ? `<img src="${aPhoto}" alt="${nomCourt}" class="w-full h-full object-cover" />`
            : `<span class="text-2xl">${avatarInfo.emoji}</span>`);
      }

      // Statut d'ouverture en direct — uniquement pour les établissements
      // (demande explicite : ne rien changer pour produit/service). Ce bloc
      // tournait avant pour TOUS les types, écrasant à tort l'indicateur "en
      // stock" (pointStatutTooltip, ligne ci-dessus) des boutiques produit.
      if (typeBoutique === "etablissement") {
        const modeH = b.mode_horaires || "indiques";
        if (modeH === "toujours_ouvert") {
          pointStatutTooltip = "bg-[#10B981] animate-pulse";
          badgeLive = `<div class="absolute -bottom-1 bg-[#10B981] text-gray-950 text-[7px] font-black uppercase px-1.5 py-0.2 rounded-full border border-white shadow-xs">24/7</div>`;
        } else if (modeH === "sur_rendez_vous") {
          pointStatutTooltip = "bg-sky-400";
          badgeLive = `<div class="absolute -bottom-1 bg-sky-500 text-white text-[7px] font-black uppercase px-1.5 py-0.2 rounded-full border border-white shadow-xs">RDV</div>`;
        } else {
          const st = calculerStatutOuverture(b, b.horaires);
          // renseigne===false : mode "indiques" jamais configuré — aucun
          // badge plutôt qu'un "Fermé" trompeur (même règle que le badge de
          // l'onglet Domaine).
          if (st?.renseigne) {
            if (st.ouvert) {
              pointStatutTooltip = "bg-[#10B981] animate-pulse";
              badgeLive = `<div class="absolute -bottom-1 bg-[#10B981] text-gray-950 text-[7px] font-black uppercase px-1.5 py-0.2 rounded-full border border-white shadow-xs">OUVERT</div>`;
            } else {
              pointStatutTooltip = "bg-rose-500";
              badgeLive = `<div class="absolute -bottom-1 bg-rose-500 text-white text-[7px] font-black uppercase px-1.5 py-0.2 rounded-full border border-white shadow-xs">FERMÉ</div>`;
            }
          } else {
            pointStatutTooltip = "bg-gray-400";
          }
        }
      }

      // Badge Premium Marketplace (Point 6) — coin opposé à badgeLive
      // (statut d'ouverture) pour ne jamais les superposer.
      const premiumBadgeHtml = b.estPremium
        ? `<div class="absolute -top-1 -right-1 bg-amber-400 text-gray-950 text-[9px] px-1 rounded-full border border-white shadow-xs">👑</div>`
        : "";

      const htmlMarqueur = `
        <div class="snap-marker-pin group flex flex-col items-center select-none cursor-pointer transform transition-all duration-300 hover:scale-115 ${
          estSelectionne ? "scale-115 z-50" : "z-10"
        }">
          <!-- Bulle Tooltip / Badge au-dessus de l'avatar -->
          <div class="mb-1.5 px-3 py-1 bg-gray-900/95 text-white rounded-full text-[10px] font-black shadow-2xl border border-gray-700/80 flex items-center gap-1.5 whitespace-nowrap backdrop-blur-md">
            <span class="w-2 h-2 rounded-full ${pointStatutTooltip}"></span>
            <span class="font-extrabold max-w-[110px] truncate text-white">${nomCourt}</span>
            <span class="text-[9px] font-bold text-gray-400">· ${quartier}</span>
          </div>

          <!-- Avatar Circulaire avec Bordure Colorée (#10B981 ou #2563EB) & Story Ring.
               avatar-boutique-zoom-scale (redimensionné en JS sur zoomend) et
               avatar-boutique-anime (respiration CSS, sur l'enfant) doivent
               rester deux éléments distincts — sinon l'animation qui tourne
               écrase le transform:scale() posé par le JS. -->
          <div class="relative w-13 h-13 rounded-full p-[3px] shadow-2xl flex items-center justify-center avatar-boutique-zoom-scale" style="background: ${bordureCouleur}; box-shadow: 0 4px 14px ${bordureCouleur}60;">
            <div class="w-full h-full rounded-full overflow-hidden bg-gray-900 flex items-center justify-center border-2 border-white dark:border-gray-950 shadow-inner avatar-boutique-anime">
              ${contenuAvatar}
            </div>
            ${badgeLive}
            ${premiumBadgeHtml}
          </div>

          <!-- Ombre portée 3D au sol -->
          <div class="w-8 h-2 bg-black/60 rounded-full blur-[1.5px] mt-1"></div>
        </div>
      `;

      const icone = L.divIcon({
        html: htmlMarqueur,
        className: "snap-custom-icon",
        iconSize: [140, 90],
        iconAnchor: [70, 85],
      });

      const marqueur = L.marker([b.lat, b.lng], { icon: icone }).addTo(groupe);

      // Carrousel de produits au survol de la boutique (Inspiré de la capture utilisateur)
      const articlesBoutique = (b.articles && b.articles.length > 0)
        ? b.articles
        : (tousArticles || []).filter((a) => a.boutique_id === b.id);
      const articlesApercu = articlesBoutique.slice(0, 6);

      const htmlBulleProduits = `
        <div class="bulle-produits-container" style="position:relative; width:210px; max-width:240px; background:#ffffff; border-radius:18px; padding:10px 10px 8px 10px; font-family:inherit; color:#0f172a; box-shadow: 0 16px 36px rgba(0,0,0,0.35);">
          <!-- Bouton Fermer X -->
          <button type="button" class="btn-fermer-bulle" style="position:absolute; top:7px; right:8px; width:20px; height:20px; border-radius:9999px; background:#f1f5f9; border:none; display:flex; align-items:center; justify-content:center; color:#64748b; font-size:11px; font-weight:900; cursor:pointer; z-index:20; line-height:1;" title="Fermer">✕</button>

          <!-- En-tête : Nom boutique + quartier -->
          <div class="btn-ouvrir-boutique-header" style="cursor:pointer; margin-bottom:8px; padding-right:22px;">
            <div style="font-size:12px; font-weight:900; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.2;">${nomCourt}</div>
            <div style="font-size:9.5px; font-weight:600; color:#64748b; display:flex; align-items:center; gap:3px; margin-top:2px;">
              <span style="color:#0284c7;">📍</span> <span>${quartier}</span>
              ${b.distance_km ? `<span style="color:#94a3b8;">· ${distanceLisible(b.distance_km)}</span>` : ""}
            </div>
          </div>

          <!-- Carrousel des produits -->
          ${
            articlesApercu.length > 0
              ? `
                <div style="display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; padding:2px 1px 4px 1px; -webkit-overflow-scrolling:touch;">
                  ${articlesApercu
                    .map((art) => {
                      const photoUrl = art.photos?.[0] ? urlPhoto(art.photos[0]) : (art.photo ? urlPhoto(art.photo) : "");
                      const prixTxt = art.prix_xof || art.prix;
                      return `
                        <div data-article-id="${art.id}" style="flex-shrink:0; width:84px; height:110px; border-radius:14px; overflow:hidden; background:#c4a4b8; position:relative; box-shadow:0 3px 10px rgba(0,0,0,0.15); cursor:pointer; transition:transform 0.15s ease;">
                          ${
                            photoUrl
                              ? `<img src="${photoUrl}" alt="${echapperHtml(art.titre || "")}" style="width:100%; height:100%; object-fit:cover; display:block;" onerror="this.replaceWith(Object.assign(document.createElement('div'),{style:'width:100%;height:100%;background:#c4a4b8;display:flex;align-items:center;justify-content:center;font-size:22px;',textContent:'🛍️'}))" />`
                              : `<div style="width:100%; height:100%; background:linear-gradient(135deg,#c4a4b8,#a88b9e); display:flex; align-items:center; justify-content:center; font-size:22px;">🛍️</div>`
                          }
                          <div style="position:absolute; bottom:0; left:0; right:0; padding:6px 5px 4px 5px; background:linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 70%, transparent 100%); color:#ffffff;">
                            <div style="font-size:8.5px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.1;">${echapperHtml(art.titre || "Article")}</div>
                            ${prixTxt ? `<div style="font-size:9.5px; font-weight:900; color:#34d399; margin-top:2px;">${Number(prixTxt).toLocaleString("fr-FR")} F</div>` : ""}
                          </div>
                        </div>
                      `;
                    })
                    .join("")}
                </div>
              `
              : `
                <div class="btn-ouvrir-boutique-header" style="width:100%; padding:14px 8px; text-align:center; background:#f8fafc; border-radius:12px; border:1px dashed #cbd5e1; cursor:pointer;">
                  <div style="font-size:18px; margin-bottom:2px;">🏪</div>
                  <div style="font-size:10px; font-weight:700; color:#64748b;">Découvrir la boutique</div>
                </div>
              `
          }
        </div>
      `;

      const popup = L.popup({
        className: "carte-bulle-produits-popup",
        closeButton: false,
        offset: [0, -38],
        autoPan: false,
        closeOnClick: false,
      }).setContent(htmlBulleProduits);

      let timerSurvol = null;

      const attacherEcouteursPopup = () => {
        setTimeout(() => {
          const el = popup.getElement();
          if (!el) return;

          el.addEventListener("mouseenter", () => {
            if (timerSurvol) clearTimeout(timerSurvol);
          });
          el.addEventListener("mouseleave", () => {
            timerSurvol = setTimeout(() => {
              carte.closePopup(popup);
            }, 300);
          });

          const btnFermer = el.querySelector(".btn-fermer-bulle");
          if (btnFermer) {
            btnFermer.onclick = (e) => {
              e.stopPropagation();
              carte.closePopup(popup);
            };
          }

          el.querySelectorAll(".btn-ouvrir-boutique-header").forEach((btn) => {
            btn.onclick = (e) => {
              e.stopPropagation();
              carte.closePopup(popup);
              setBoutiqueSelectionnee(b);
              setVueBoutiqueDetails(true);
            };
          });

          el.querySelectorAll("[data-article-id]").forEach((card) => {
            card.onclick = (e) => {
              e.stopPropagation();
              carte.closePopup(popup);
              const artId = card.getAttribute("data-article-id");
              if (typeof onVoirArticle === "function") {
                onVoirArticle(artId);
              } else {
                setBoutiqueSelectionnee(b);
                setVueBoutiqueDetails(true);
              }
            };
          });
        }, 10);
      };

      marqueur.on("mouseover", () => {
        if (timerSurvol) clearTimeout(timerSurvol);
        popup.setLatLng([b.lat, b.lng]).openOn(carte);
        attacherEcouteursPopup();
      });

      marqueur.on("mouseout", () => {
        timerSurvol = setTimeout(() => {
          carte.closePopup(popup);
        }, 300);
      });

      marqueur.on("click", () => {
        gererClicPointCluster([b.lat, b.lng], () => {
          setBoutiqueSelectionnee(b);
          setVueBoutiqueDetails(true);
          carte.flyTo([b.lat, b.lng], 15.5, { duration: 1.1 });
        });
      });
    });

    // Détache l'écouteur précédent avant d'en reposer un : ce callback est
    // rappelé à chaque rafraîchissement des marqueurs (pas seulement à la
    // création de la carte), sans ça chaque passage en accumulerait un de
    // plus sur le même objet carte.
    if (echelleZoomCleanupRef.current) {
      echelleZoomCleanupRef.current();
    }
    echelleZoomCleanupRef.current = brancherEchelleZoomAvatars(carte);
  }, [boutiquesAffichees, boutiqueSelectionnee, gererClicPointCluster]);
  // Mise à jour hors rendu (règle react-hooks/refs) : un effet sans
  // dépendances s'exécute après chaque rendu, donc toujours à temps avant
  // que les timers de forcerTaille (au plus tôt 50 ms plus tard) ne lisent
  // cette ref.
  useEffect(() => {
    rafraichirMarqueursRef.current = rafraichirMarqueurs;
  });

  // Complète l'appel direct fait dans forcerTaille (voir plus haut) pour le
  // cas où boutiquesAffichees/boutiqueSelectionnee changent SANS que la
  // carte soit recréée (ex. clic sur une pastille de filtre) — la carte
  // existante reste alors valide, seul son contenu doit se rafraîchir.
  useEffect(() => {
    rafraichirMarqueurs();
  }, [rafraichirMarqueurs, cartePrete]);

  // Recentrage automatique (fitBounds) quand une recherche ou un onglet de
  // filtre change activement la sélection de boutiques affichées — même
  // convention que CarteBoutiques.jsx/CarteItineraire.jsx/CarteEtablissements.jsx
  // (padding [28,28], maxZoom 15). Volontairement PAS déclenché par
  // boutiquesAffichees directement : ce tableau change aussi au premier
  // chargement des données (boutiques passe de [] à la vraie liste) sans
  // aucune action de l'utilisateur, ce qui écraserait le centrage initial
  // existant (centreInitial, plus haut) sans que ce soit demandé ici.
  const premierFiltreRef = useRef(true);
  useEffect(() => {
    if (premierFiltreRef.current) {
      premierFiltreRef.current = false;
      return;
    }
    const carte = carteRef.current;
    if (!carte || boutiquesAffichees.length === 0) return;
    (async () => {
      const L = (await import("leaflet")).default;
      carte.fitBounds(L.latLngBounds(boutiquesAffichees.map((b) => [b.lat, b.lng])), {
        padding: [28, 28],
        maxZoom: 15,
      });
    })();
    // boutiquesAffichees volontairement absent des dépendances — voir
    // commentaire ci-dessus, seul le déclencheur (recherche/onglet) compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtreActif, rechercheNormalisee]);

  // Horaires d'ouverture, chargés seulement pour un établissement dont la
  // fiche est ouverte — inutile pour produit/service, qui n'ont pas de
  // marketplace_horaires.
  useEffect(() => {
    if (!vueBoutiqueDetails || boutiqueSelectionnee?.type_boutique !== "etablissement") {
      queueMicrotask(() => setHoraires([]));
      return;
    }
    let annule = false;
    queueMicrotask(() => setHorairesChargement(true));
    obtenirHorairesBoutique(boutiqueSelectionnee.id)
      .then((data) => {
        if (!annule) setHoraires(data);
      })
      .catch(() => {
        if (!annule) setHoraires([]);
      })
      .finally(() => {
        if (!annule) setHorairesChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [vueBoutiqueDetails, boutiqueSelectionnee]);

  // Place l'indicateur "Vous êtes ici" et recentre la carte sur une position
  // déjà connue — factorisé pour servir à la fois au bouton "Autour de moi"
  // du Globe (qui géolocalise lui-même) et à positionInitiale (déjà
  // géolocalisée par le Marketplace avant l'ouverture du Globe).
  const centrerSurPosition = useCallback(async (pos, { animer = true } = {}) => {
    const L = (await import("leaflet")).default;
    const carte = carteRef.current;
    if (!carte || !pos) return;

    if (marqueurMoiRef.current) {
      marqueurMoiRef.current.remove();
    }

    const htmlMoi = `
      <div class="relative flex flex-col items-center select-none cursor-pointer">
        <div class="absolute -inset-4 bg-sky-500/30 rounded-full animate-ping pointer-events-none"></div>
        <div class="relative w-12 h-12 rounded-full bg-gradient-to-tr from-sky-400 to-blue-600 p-0.5 shadow-2xl border-2 border-white flex items-center justify-center text-xl">
          <span>🧑🏾</span>
        </div>
        <div class="mt-1 px-2.5 py-0.5 bg-blue-600 text-white text-[9px] font-black rounded-full shadow-lg border border-white whitespace-nowrap">
          Vous êtes ici
        </div>
      </div>
    `;

    const iconeMoi = L.divIcon({
      html: htmlMoi,
      className: "snap-custom-moi",
      iconSize: [100, 75],
      iconAnchor: [50, 70],
    });

    // Pane dédié sous markerPane (600, où vivent les marqueurs boutique) :
    // quand la position de l'utilisateur coïncide avec une boutique,
    // "Vous êtes ici" reste EN DESSOUS pour le survol ET le clic, quel que
    // soit l'ordre de création des marqueurs. Même correctif que
    // CarteBoutiques.jsx — le clic seul avait été corrigé (v92/v96), pas
    // le survol.
    if (!carte.getPane("paneMoi")) {
      carte.createPane("paneMoi");
      carte.getPane("paneMoi").style.zIndex = 350;
    }

    marqueurMoiRef.current = L.marker([pos.latitude, pos.longitude], { icon: iconeMoi, pane: "paneMoi" }).addTo(carte);
    // Sans ceci, "Vous êtes ici" ne réagissait jamais au clic — et quand il
    // se superposait à une boutique (position de démo confondue avec sa
    // propre boutique), il interceptait le clic sans rien faire à la place.
    marqueurMoiRef.current.on("click", () => {
      gererClicPointCluster([pos.latitude, pos.longitude], () => {
        carte.flyTo([pos.latitude, pos.longitude], Math.min(carte.getZoom() + 3, 17), { duration: 0.6 });
      });
    });
    if (animer) {
      carte.flyTo([pos.latitude, pos.longitude], 15.5, { duration: 1.2 });
    } else {
      carte.setView([pos.latitude, pos.longitude], 15.5);
    }
  }, [gererClicPointCluster]);
  // Même raisonnement que rafraichirMarqueursRef ci-dessus.
  useEffect(() => {
    centrerSurPositionRef.current = centrerSurPosition;
  });

  // Centrer sur la position GPS de l'utilisateur avec indicateur "Vous êtes ici"
  const allerAMaPosition = async () => {
    setErreurLocalisation("");
    setLocalisationEnCours(true);
    try {
      const pos = await positionActuelle();
      await centrerSurPosition(pos);
    } catch (err) {
      setErreurLocalisation(err.message || "Position GPS non accessible.");
    } finally {
      setLocalisationEnCours(false);
    }
  };

  // Auto-centrage si le Marketplace a déjà géolocalisé l'utilisateur avant
  // d'ouvrir le Globe (bouton "Autour de moi") — sans animation de vol, la
  // carte s'ouvre directement centrée, pas de second appel de géolocalisation.
  // Complète l'appel direct fait dans forcerTaille (voir plus haut) pour le
  // cas où positionInitiale arrive/change alors qu'une carte valide existe
  // déjà (rare, mais possible).
  useEffect(() => {
    if (positionInitiale && cartePrete) {
      centrerSurPosition(positionInitiale, { animer: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionInitiale, cartePrete]);

  // Sélection rapide depuis le carrousel
  const selectionnerBoutiqueCarousel = (b) => {
    setBoutiqueSelectionnee(b);
    setVueBoutiqueDetails(true);
    carteRef.current?.flyTo([b.lat, b.lng], 15.5, { duration: 1.1 });
  };

  // Sélection depuis la nouvelle liste d'articles (Point C) — retrouve la
  // boutique correspondante et réutilise TEL QUEL selectionnerBoutiqueCarousel
  // (flyTo + mise en avant du marqueur) plutôt que de dupliquer ce mécanisme.
  const selectionnerArticleCarousel = (article) => {
    const boutique = marqueurs.find((b) => b.id === article.boutique_id);
    if (boutique) selectionnerBoutiqueCarousel(boutique);
  };

  // Basculer le style de carte (Dark Matter / Pastel / Satellite)
  const changerStyle = () => {
    const suivant = styleActif === "dark" ? "voyager" : styleActif === "voyager" ? "satellite" : "dark";
    setStyleActif(suivant);
  };

  return (
    <div
      // z-[70] laissait passer les éléments z-[400] de CarteBoutiques
      // (boutons flottants + dock avatars) à travers ce plein écran — la
      // carte compacte reste montée derrière (position ne devient pas
      // fausse à l'ouverture d'Explorer), seul le z-index empêchait ce
      // plein écran de vraiment tout recouvrir. z-[2000] : marge
      // confortable au-dessus des contrôles Leaflet eux-mêmes (leur
      // z-index par défaut atteint 1000), sous les modales vraiment
      // globales (ex. AuthRequiredModal, z-[9999]) qui doivent pouvoir
      // s'afficher par-dessus même Explorer.
      className="fixed inset-0 z-[2000] flex flex-col bg-[#0B0F17] overflow-hidden select-none font-sans"
      role="dialog"
      aria-modal="true"
      aria-label="Facilité Snap Map Sénégal"
    >
      {/* 1. EN-TÊTE SUPÉRIEUR SNAP MAP (Sombre, Météo Dakar/Thiès & Filtres) */}
      <header className="absolute top-0 inset-x-0 z-20 pt-3 pb-2 px-3 sm:px-5 bg-gradient-to-b from-black/90 via-black/50 to-transparent pointer-events-none flex flex-col gap-2">
        <div className="flex items-center justify-between">
          {/* Avatar Utilisateur Gauche + Météo */}
          <div className="pointer-events-auto flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full border-2 border-emerald-400 bg-gradient-to-tr from-emerald-500 to-teal-600 shadow-lg flex items-center justify-center text-lg">
              <span>👤</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-white font-black text-base sm:text-lg tracking-tight drop-shadow">
                  Dakar · Thiès
                </h1>
                <span className="text-amber-300 text-xs font-bold drop-shadow">🌙 30°C</span>
              </div>
              <p className="text-emerald-400 text-[11px] font-bold drop-shadow flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                {marqueurs.length} membre{marqueurs.length > 1 ? "s" : ""} &amp; boutique{marqueurs.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Bouton Fermer */}
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onFermer}
              className="w-10 h-10 rounded-full bg-gray-900/80 hover:bg-gray-800 text-white flex items-center justify-center cursor-pointer transition backdrop-blur-md border border-gray-700 shadow-xl"
              aria-label="Fermer la carte"
              title="Retourner au Marketplace"
            >
              <i className="fa-solid fa-xmark text-base"></i>
            </button>
          </div>
        </div>

        {/* Recherche mot-clé haute-fidélité (Inspiration E-Commerce / AliExpress) :
            Contour orange vif (#FF5500), scan photo IA par caméra, bouton dégradé chaud "Rechercher",
            filtre instantané des marqueurs carte et dock articles. */}
        <div className="pointer-events-auto relative w-full">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              inputRechercheRef.current?.blur();
              if (boutiquesAffichees.length > 0 && carteRef.current) {
                (async () => {
                  const L = (await import("leaflet")).default;
                  carteRef.current.fitBounds(
                    L.latLngBounds(boutiquesAffichees.map((b) => [b.lat, b.lng])),
                    { padding: [35, 35], maxZoom: 15 }
                  );
                })();
              }
            }}
            style={{ backgroundColor: "#e3dbcc", borderColor: "#e3dbcc" }}
            className="relative flex items-center w-full bg-[#e3dbcc] rounded-full border-2 border-[#e3dbcc] shadow-xl p-1 pl-3.5 sm:pl-4 transition-all duration-300 focus-within:ring-2 focus-within:ring-[#c4b89f]"
          >
            <input
              ref={inputRechercheRef}
              type="text"
              value={rechercheCarte}
              onChange={(e) => setRechercheCarte(e.target.value)}
              placeholder={
                scanPhotoEnCours
                  ? "Scan IA en cours, analyse de l'image..."
                  : "Rechercher un article, une boutique..."
              }
              disabled={scanPhotoEnCours}
              className="flex-1 min-w-0 bg-transparent text-stone-950 text-xs sm:text-sm font-bold placeholder:text-stone-600 focus:outline-none pr-1.5"
            />

            {/* Bouton Effacer rapide */}
            {rechercheCarte && !scanPhotoEnCours && (
              <button
                type="button"
                onClick={() => {
                  setRechercheCarte("");
                  inputRechercheRef.current?.focus();
                }}
                className="w-5 h-5 rounded-full bg-stone-300/80 hover:bg-stone-400/80 text-stone-800 flex items-center justify-center text-[10px] cursor-pointer mr-1.5 transition shrink-0"
                aria-label="Effacer la recherche"
                title="Effacer"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}

            {/* Icône Appareil Photo / Recherche Visuelle IA (Style signature AliExpress) */}
            <label
              className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-black/5 cursor-pointer text-stone-800 hover:text-black transition group mr-1.5 shrink-0"
              title="Rechercher par photo (IA Scanner Vision)"
            >
              <input
                ref={fileInputPhotoRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleScanPhotoRecherche}
                className="hidden"
                disabled={scanPhotoEnCours}
              />
              {scanPhotoEnCours ? (
                <i className="fa-solid fa-circle-notch fa-spin text-sm text-[#10E688]"></i>
              ) : (
                <div className="relative flex flex-col items-center justify-center pt-0.5">
                  {/* Petite barre vert émeraude supérieure caractéristique */}
                  <span className="w-3.5 h-[2px] bg-[#10E688] rounded-full mb-[2px] group-hover:w-4 transition-all"></span>
                  {/* Appareil photo épuré */}
                  <svg
                    className="w-4 h-4 text-gray-700 group-hover:text-black group-hover:scale-105 transition-transform"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
              )}
            </label>

            {/* Bouton Pilule Vert Facilité Officiel (#10E688 / Émeraude) */}
            <button
              type="submit"
              disabled={scanPhotoEnCours}
              className="shrink-0 flex items-center gap-1.5 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full bg-gradient-to-r from-[#10E688] via-[#059669] to-[#047857] hover:from-[#13f591] hover:via-[#059669] hover:to-[#065f46] text-white font-black text-xs sm:text-sm tracking-tight shadow-md shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer select-none"
            >
              {/* Loupe avec étincelle intégrée */}
              <svg
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <path d="M11 8.5v5M8.5 11h5" stroke="currentColor" strokeWidth="2" />
              </svg>
              <span>Rechercher</span>
            </button>
          </form>

          {/* Indication visuelle si scan photo en cours */}
          {scanPhotoEnCours && (
            <div className="absolute -bottom-6 left-4 text-[11px] font-bold text-amber-300 drop-shadow flex items-center gap-1.5 animate-pulse">
              <i className="fa-solid fa-wand-magic-sparkles text-xs text-[#10E688]"></i>
              <span>L'intelligence artificielle analyse votre photo...</span>
            </div>
          )}
        </div>

        {/* Pilules de filtres thématiques (Dark Snap Map) */}
        <div className="pointer-events-auto flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            type="button"
            onClick={() => setFiltreActif("tous")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shadow-md backdrop-blur-md ${
              filtreActif === "tous"
                ? "bg-white text-gray-950 font-black shadow-white/20"
                : "bg-gray-900/80 text-white hover:bg-gray-800 border border-gray-700/80"
            }`}
          >
            <i className="fa-solid fa-compass text-xs text-sky-400"></i>
            <span>Toutes les boutiques</span>
          </button>

          <button
            type="button"
            onClick={() => setFiltreActif("populaires")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shadow-md backdrop-blur-md ${
              filtreActif === "populaires"
                ? "bg-white text-gray-950 font-black shadow-white/20"
                : "bg-gray-900/80 text-white hover:bg-gray-800 border border-gray-700/80"
            }`}
          >
            <i className="fa-solid fa-trophy text-xs text-amber-400"></i>
            <span>Les plus visités</span>
          </button>

          <button
            type="button"
            onClick={() => setFiltreActif("live")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shadow-md backdrop-blur-md ${
              filtreActif === "live"
                ? "bg-white text-gray-950 font-black shadow-white/20"
                : "bg-gray-900/80 text-white hover:bg-gray-800 border border-gray-700/80"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
            <span>En stock (LIVE)</span>
          </button>

          <button
            type="button"
            onClick={allerAMaPosition}
            className="px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap bg-gray-900/80 hover:bg-gray-800 text-white border border-gray-700/80 transition cursor-pointer flex items-center gap-1.5 shadow-md backdrop-blur-md"
          >
            <i className="fa-solid fa-location-crosshairs text-xs text-emerald-400"></i>
            <span>Autour de moi</span>
          </button>
        </div>
      </header>

      {/* 2. CONTENEUR CARTE LEAFLET */}
      <div className="relative flex-1 w-full h-full min-h-0 bg-[#0B0F17]">
        <div ref={conteneurRef} className="absolute inset-0 w-full h-full z-0 bg-[#0B0F17]" />

        {/* Cadre de sélection — déplaçable (glisser) et redimensionnable
            (poignée en bas à droite), validé via le bouton au centre. */}
        {modeSelectionActif && (
          <div
            onPointerDown={gererPointerDownDeplacer}
            className="absolute z-[410] rounded-2xl border-2 border-white/80 bg-white/10 backdrop-blur-[1px] cursor-move touch-none"
            style={{ left: cadre.x, top: cadre.y, width: cadre.largeur, height: cadre.hauteur }}
          >
            <div
              onPointerDown={gererPointerDownRedimensionner}
              className="absolute -bottom-2 -right-2 w-5 h-5 rounded-full bg-white border-2 border-orange-500 cursor-nwse-resize touch-none"
              title="Redimensionner"
            />
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={voirBoutiquesDansLeCadre}
              className="absolute -bottom-6 left-1/2 -translate-x-1/2 translate-y-full mt-2 w-11 h-11 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-2xl active:scale-95 shadow-orange-500/50 cursor-pointer"
              title="Voir les boutiques dans ce cadre"
            >
              <i className="fa-solid fa-magnifying-glass text-base"></i>
            </button>
          </div>
        )}

        {/* 3. CONTRÔLES FLOTTANTS SNAP MAP (À droite) */}
        <aside className="absolute right-3.5 top-28 sm:top-24 z-20 flex flex-col gap-2.5">
          {/* Bouton Ma Position */}
          <button
            type="button"
            onClick={allerAMaPosition}
            disabled={localisationEnCours}
            className="w-11 h-11 rounded-full bg-gray-900/90 hover:bg-gray-800 text-white flex items-center justify-center shadow-2xl border border-gray-700 hover:scale-105 active:scale-95 transition cursor-pointer relative backdrop-blur-md"
            title="Centrer sur ma position"
            aria-label="Ma position"
          >
            <i
              className={`fa-solid ${
                localisationEnCours ? "fa-spinner fa-spin text-blue-400" : "fa-location-arrow text-blue-400 text-base"
              }`}
            ></i>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-gray-900 animate-pulse" />
          </button>

          {/* Bouton Thème / Style Carte (Dark Matter ↔ Voyager ↔ Satellite) */}
          <button
            type="button"
            onClick={changerStyle}
            className="w-11 h-11 rounded-full bg-gray-900/90 hover:bg-gray-800 text-white flex items-center justify-center shadow-2xl border border-gray-700 hover:scale-105 active:scale-95 transition cursor-pointer backdrop-blur-md"
            title="Changer de vue (Sombre / Clair / Satellite)"
            aria-label="Style de carte"
          >
            <span className="text-base">
              {styleActif === "dark" ? "🌙" : styleActif === "voyager" ? "🗺️" : "🛰️"}
            </span>
          </button>

          {/* Zoom In & Out */}
          <button
            type="button"
            onClick={() => carteRef.current?.zoomIn()}
            className="w-11 h-11 rounded-full bg-gray-900/90 hover:bg-gray-800 text-white flex items-center justify-center shadow-2xl border border-gray-700 hover:scale-105 active:scale-95 transition cursor-pointer backdrop-blur-md"
            title="Zoomer"
            aria-label="Zoom avant"
          >
            <i className="fa-solid fa-plus text-sm"></i>
          </button>
          <button
            type="button"
            onClick={() => carteRef.current?.zoomOut()}
            className="w-11 h-11 rounded-full bg-gray-900/90 hover:bg-gray-800 text-white flex items-center justify-center shadow-2xl border border-gray-700 hover:scale-105 active:scale-95 transition cursor-pointer backdrop-blur-md"
            title="Dézoomer"
            aria-label="Zoom arrière"
          >
            <i className="fa-solid fa-minus text-sm"></i>
          </button>

          {/* Cadre de sélection "voir toutes les boutiques d'une zone" —
              même outil que CarteBoutiques.jsx, demandé explicitement par
              l'utilisateur pour cette vue plein écran aussi. */}
          <button
            type="button"
            onClick={() => setModeSelectionActif(!modeSelectionActif)}
            className={`w-11 h-11 rounded-full flex items-center justify-center shadow-2xl border transition cursor-pointer hover:scale-105 active:scale-95 backdrop-blur-md ${
              modeSelectionActif
                ? "bg-orange-500 border-orange-300 text-white"
                : "bg-gray-900/90 hover:bg-gray-800 text-white border-gray-700"
            }`}
            title="Voir toutes les boutiques d'une zone"
            aria-label="Cadre de sélection"
          >
            <i className="fa-solid fa-magnifying-glass text-sm"></i>
          </button>
        </aside>

        {/* Message d'erreur géolocalisation */}
        {erreurLocalisation && (
          <div className="absolute top-28 left-1/2 -translate-x-1/2 z-30 bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-2xl shadow-2xl max-w-[85%] text-center">
            {erreurLocalisation}
          </div>
        )}

        {/* 4. CARROUSEL INFÉRIEUR DE STORIES & BOUTIQUES (Style Snap Map Dock) */}
        <div className="absolute bottom-4 inset-x-0 z-20 px-3 sm:px-6 flex flex-col items-center gap-2 pointer-events-none">
          {/* Pilule d'information active */}
          <div className="pointer-events-auto px-4 py-2 rounded-full bg-[#1877F2]/95 hover:bg-[#1877F2] text-white text-xs font-extrabold shadow-2xl backdrop-blur-md border border-white/20 flex items-center gap-2 cursor-pointer transition transform hover:scale-102">
            <i className="fa-solid fa-house text-xs"></i>
            <span>
              {boutiqueSelectionnee
                ? `${boutiqueSelectionnee.nom} est ouvert à ${boutiqueSelectionnee.quartier || "Dakar"}`
                : `${marqueurs.length} boutiques vérifiées prêtes à vous servir au Sénégal`}
            </span>
          </div>

          {/* Bascule Boutiques / Articles (Point C) — deux vues dans le même
              dock, plutôt que d'empiler un second carrousel en permanence. */}
          <div className="pointer-events-auto flex items-center gap-1 bg-gray-950/80 rounded-full p-1 border border-gray-800 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setVueCarrousel("boutiques")}
              className={`px-3 py-1 rounded-full text-[10px] font-black transition cursor-pointer ${
                vueCarrousel === "boutiques" ? "bg-white text-gray-950" : "text-gray-300 hover:text-white"
              }`}
            >
              Boutiques
            </button>
            <button
              type="button"
              onClick={() => setVueCarrousel("articles")}
              className={`px-3 py-1 rounded-full text-[10px] font-black transition cursor-pointer ${
                vueCarrousel === "articles" ? "bg-white text-gray-950" : "text-gray-300 hover:text-white"
              }`}
            >
              Articles
            </button>
          </div>

          {vueCarrousel === "boutiques" ? (
            /* Barre des Avatars Snap Map Défilable Horizontalement */
            <div className="pointer-events-auto w-full max-w-lg bg-gray-950/90 rounded-3xl p-2 sm:p-2.5 shadow-2xl border border-gray-800 backdrop-blur-md flex items-center gap-3 overflow-x-auto no-scrollbar">
              {marqueurs.map((b, idx) => {
                const avatar = AVATARS_SNAP[idx % AVATARS_SNAP.length];
                const aPhoto = b.photo ? urlPhoto(b.photo) : null;
                const estSelectionne = boutiqueSelectionnee?.id === b.id;

                return (
                  <button
                    key={b.id || idx}
                    type="button"
                    onClick={() => selectionnerBoutiqueCarousel(b)}
                    className={`flex flex-col items-center gap-1 shrink-0 p-1.5 rounded-2xl transition-all cursor-pointer group ${
                      estSelectionne
                        ? "bg-blue-950/70 border border-blue-600 scale-105"
                        : "hover:bg-gray-800/80"
                    }`}
                  >
                    {/* Cercle Avatar avec contour Vert Menthe ou Bleu Roi */}
                    <div className="relative w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-[#10B981] to-emerald-400 shadow-md flex items-center justify-center">
                      <div className="w-full h-full rounded-full overflow-hidden bg-gray-900 flex items-center justify-center border border-gray-950">
                        {b.avatar_config ? (
                          <img
                            src={dataUriAvatarBoutique(b.avatar_config, 48)}
                            alt={b.nom}
                            className="w-full h-full object-cover"
                          />
                        ) : aPhoto ? (
                          <img src={aPhoto} alt={b.nom} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl">{avatar.emoji}</span>
                        )}
                      </div>
                      {estSelectionne && (
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[8px] border-2 border-gray-900">
                          ✓
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-black text-gray-200 max-w-[65px] truncate">
                      {b.nom}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Nouvelle liste d'articles individuels (Point C) — distincte du
               carrousel de boutiques ci-dessus : sélectionner un article
               retrouve sa boutique et réutilise le mécanisme flyTo existant
               (selectionnerArticleCarousel → selectionnerBoutiqueCarousel). */
            <div className="pointer-events-auto w-full max-w-lg bg-gray-950/90 rounded-3xl p-2 sm:p-2.5 shadow-2xl border border-gray-800 backdrop-blur-md flex items-center gap-3 overflow-x-auto no-scrollbar">
              {articlesFiltres.length === 0 ? (
                <p className="text-[11px] text-gray-400 font-bold px-2 py-2.5">
                  Aucun article ne correspond à cette recherche.
                </p>
              ) : (
                articlesFiltres.map((a) => {
                  const photo = a.photos?.[0] || null;
                  const estSelectionne = boutiqueSelectionnee?.id === a.boutique_id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => selectionnerArticleCarousel(a)}
                      className={`flex flex-col items-center gap-1 shrink-0 p-1.5 rounded-2xl transition-all cursor-pointer group w-16 ${
                        estSelectionne ? "bg-blue-950/70 border border-blue-600 scale-105" : "hover:bg-gray-800/80"
                      }`}
                    >
                      <div className="relative w-12 h-12 rounded-2xl overflow-hidden bg-gray-800 border border-gray-700 flex items-center justify-center">
                        {photo ? (
                          <img src={photo} alt={a.titre} className="w-full h-full object-cover" />
                        ) : (
                          <i className="fa-solid fa-tag text-gray-500 text-sm"></i>
                        )}
                      </div>
                      <span className="text-[9px] font-black text-gray-200 max-w-[65px] truncate">
                        {a.titre}
                      </span>
                      <span className="text-[8px] font-bold text-emerald-400">
                        {prixLisible(a.prix_xof)} F
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* 5. BOTTOM SHEET / FICHE BOUTIQUE DÉDIÉE (Style Snap Map Modal) */}
        {vueBoutiqueDetails && boutiqueSelectionnee && (
          <div
            className="absolute inset-0 z-40 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
            onClick={() => setVueBoutiqueDetails(false)}
          >
            <div
              className="w-full sm:max-w-md bg-gray-900 text-white rounded-t-3xl sm:rounded-3xl border border-gray-800 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col animate-slideUp"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag bar mobile */}
              <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mt-3 sm:hidden" />

              {/* Header Fiche Boutique */}
              <div className="p-4 sm:p-5 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black flex items-center justify-center text-lg shadow-md shrink-0 overflow-hidden">
                    {boutiqueSelectionnee.avatar_config ? (
                      <img
                        src={dataUriAvatarBoutique(boutiqueSelectionnee.avatar_config, 48)}
                        alt={boutiqueSelectionnee.nom}
                        className="w-full h-full object-cover"
                      />
                    ) : boutiqueSelectionnee.photo ? (
                      <img
                        src={urlPhoto(boutiqueSelectionnee.photo)}
                        alt={boutiqueSelectionnee.nom}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      boutiqueSelectionnee.nom?.substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm sm:text-base font-black text-white truncate">
                        {boutiqueSelectionnee.nom}
                      </h3>
                      <i className="fa-solid fa-circle-check text-sky-400 text-xs"></i>
                      {boutiqueSelectionnee.estPremium && (
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-400 text-[9px] font-black uppercase tracking-wider shrink-0">
                          👑 Premium
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 font-medium truncate flex items-center gap-1">
                      <i className="fa-solid fa-location-dot text-[#1877F2]"></i>
                      {boutiqueSelectionnee.quartier ? `${boutiqueSelectionnee.quartier}, ` : ""}
                      {boutiqueSelectionnee.ville || "Dakar"} · Sénégal
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setVueBoutiqueDetails(false)}
                  className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 flex items-center justify-center transition cursor-pointer shrink-0"
                  aria-label="Fermer"
                >
                  <i className="fa-solid fa-xmark text-sm"></i>
                </button>
              </div>

              {/* Bouton WhatsApp Vert Grand Format */}
              <div className="p-4 sm:p-5 border-b border-gray-800 bg-gray-950/60">
                {boutiqueSelectionnee.whatsappUrl ? (
                  <a
                    href={boutiqueSelectionnee.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40 transition cursor-pointer"
                  >
                    <i className="fa-brands fa-whatsapp text-lg"></i>
                    {boutiqueSelectionnee.type_boutique === "service"
                      ? "Décrire votre besoin sur WhatsApp"
                      : boutiqueSelectionnee.type_boutique === "etablissement"
                        ? "Contacter sur WhatsApp"
                        : "Discuter et commander sur WhatsApp"}
                  </a>
                ) : (
                  <p className="text-xs text-gray-400 text-center font-bold">
                    WhatsApp direct disponible auprès du vendeur
                  </p>
                )}
              </div>

              {/* Contenu de la fiche, adapté au type_boutique */}
              {boutiqueSelectionnee.type_boutique === "service" ? (
                <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                    <i className="fa-solid fa-screwdriver-wrench text-amber-400"></i>
                    Métier
                  </h4>
                  <p className="text-sm font-bold text-white">
                    {boutiqueSelectionnee.metier || "Service"}
                  </p>
                  {boutiqueSelectionnee.description_prestation && (
                    <>
                      <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 mt-4">
                        Description
                      </h4>
                      <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">
                        {boutiqueSelectionnee.description_prestation}
                      </p>
                    </>
                  )}
                  <p className="text-xs text-gray-500 italic pt-2">
                    Zone d&apos;intervention : {boutiqueSelectionnee.quartier || boutiqueSelectionnee.ville || "Dakar"}
                  </p>
                </div>
              ) : boutiqueSelectionnee.type_boutique === "etablissement" ? (
                <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
                  {(() => {
                    const statut = calculerStatutOuverture(boutiqueSelectionnee, horaires);
                    const { jourSemaine } = obtenirDateHeureDakar();
                    const modeH = boutiqueSelectionnee.mode_horaires || "indiques";

                    return (
                      <>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                            <i className="fa-solid fa-clock text-violet-400"></i>
                            Horaires d&apos;ouverture
                          </h4>
                          {statut?.texteBadge && (
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                statut.mode === "toujours_ouvert" || statut.ouvert
                                  ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/80"
                                  : statut.mode === "sur_rendez_vous"
                                    ? "bg-sky-950/80 text-sky-400 border border-sky-800/80"
                                    : "bg-rose-950/80 text-rose-400 border border-rose-800/80"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  statut.mode === "toujours_ouvert" || statut.ouvert
                                    ? "bg-emerald-400 animate-pulse"
                                    : statut.mode === "sur_rendez_vous"
                                      ? "bg-sky-400"
                                      : "bg-rose-500"
                                }`}
                              ></span>
                              <span>{statut.texteBadge}</span>
                            </span>
                          )}
                        </div>

                        {horairesChargement ? (
                          <p className="text-xs text-gray-500 italic">Chargement…</p>
                        ) : modeH === "toujours_ouvert" ? (
                          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-center gap-2.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            <div>
                              <p className="text-xs font-black text-emerald-300">Ouvert 24h/24, 7j/7</p>
                              <p className="text-[11px] text-emerald-400/80">Accueil en continu sans interruption.</p>
                            </div>
                          </div>
                        ) : modeH === "sur_rendez_vous" ? (
                          <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-800/60 flex items-center gap-2.5">
                            <i className="fa-regular fa-calendar-check text-sky-400 text-sm"></i>
                            <div>
                              <p className="text-xs font-black text-sky-300">Sur rendez-vous uniquement</p>
                              <p className="text-[11px] text-sky-400/80">Veuillez contacter l&apos;établissement au préalable.</p>
                            </div>
                          </div>
                        ) : horaires.length === 0 ? (
                          <p className="text-xs text-gray-500 italic">Horaires non renseignés par l&apos;établissement.</p>
                        ) : (
                          <ul className="text-xs text-gray-200 divide-y divide-gray-800/80 rounded-xl bg-gray-950/60 border border-gray-800/80 p-2 space-y-0.5">
                            {[1, 2, 3, 4, 5, 6, 0].map((j) => {
                              const h = horaires.find((item) => Number(item.jour_semaine) === j);
                              const estAujourdhui = j === jourSemaine;
                              const ferme = !h || h.ferme_ce_jour || !h.heure_ouverture || !h.heure_fermeture;
                              return (
                                <li
                                  key={j}
                                  className={`flex items-center justify-between py-1.5 px-2 rounded-lg ${
                                    estAujourdhui ? "bg-gray-800/80 font-bold text-white shadow-xs" : ""
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold">{JOURS_SEMAINE[j]}</span>
                                    {estAujourdhui && (
                                      <span className="px-1.5 py-0.2 rounded bg-blue-900/80 text-blue-300 text-[8px] font-black uppercase">
                                        Aujourd&apos;hui
                                      </span>
                                    )}
                                  </div>
                                  <span className={ferme ? "text-gray-500" : estAujourdhui ? "text-emerald-400 font-black" : "text-gray-300"}>
                                    {ferme
                                      ? "Fermé"
                                      : `${h.heure_ouverture?.slice(0, 5) || "?"} – ${h.heure_fermeture?.slice(0, 5) || "?"}`}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </>
                    );
                  })()}
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 mt-4">
                    Infos pratiques
                  </h4>
                  <p className="text-xs text-gray-300">
                    Catégorie :{" "}
                    {LIBELLES_CATEGORIE_ETABLISSEMENT[boutiqueSelectionnee.categorie_etablissement] || "Établissement"}
                    {boutiqueSelectionnee.verifie && (
                      <span className="ml-2 text-emerald-400 font-bold">✓ Vérifié</span>
                    )}
                  </p>
                </div>
              ) : (
                <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                      <i className="fa-solid fa-store text-[#1877F2]"></i>
                      Articles en rayon ({boutiqueSelectionnee.articles?.length || 0})
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setVueBoutiqueDetails(false);
                        onVoirBoutique?.(boutiqueSelectionnee);
                      }}
                      className="text-xs font-bold text-sky-400 hover:underline cursor-pointer"
                    >
                      Voir la boutique
                    </button>
                  </div>

                  {boutiqueSelectionnee.articles && boutiqueSelectionnee.articles.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2.5">
                      {boutiqueSelectionnee.articles.map((art) => (
                        <div
                          key={art.id}
                          onClick={() => {
                            setVueBoutiqueDetails(false);
                            onVoirArticle?.(art);
                          }}
                          className="group p-2 rounded-2xl border border-gray-800 bg-gray-950/70 hover:border-gray-700 transition cursor-pointer flex flex-col justify-between"
                        >
                          <div className="aspect-square w-full rounded-xl overflow-hidden bg-gray-800 mb-1.5">
                            {art.photos?.[0] ? (
                              <img
                                src={urlPhoto(art.photos[0])}
                                alt={art.titre}
                                className="w-full h-full object-cover group-hover:scale-105 transition"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                                🛍️
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-gray-100 line-clamp-1">
                              {art.titre}
                            </p>
                            <p className="text-[11px] font-black text-[#10B981] mt-0.5">
                              {prixLisible(art.prix_xof)} FCFA
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-4">
                      Aucun article publié pour le moment.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
