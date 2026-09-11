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

  // Filtrer les boutiques avec coordonnées valides
  const marqueurs = useMemo(() => {
    return boutiques.filter(
      (b) => Number.isFinite(b.lat) && Number.isFinite(b.lng) && (b.lat !== 0 || b.lng !== 0)
    );
  }, [boutiques]);

  // Boutiques filtrées selon l'onglet
  const boutiquesAffichees = useMemo(() => {
    if (filtreActif === "live") {
      return marqueurs.filter(
        (b) => b.statut === "en_stock" || (b.articles && b.articles.some((a) => a.statut === "en_stock"))
      );
    }
    if (filtreActif === "populaires") {
      return marqueurs.slice(0, Math.max(3, Math.ceil(marqueurs.length / 2)));
    }
    return marqueurs;
  }, [marqueurs, filtreActif]);

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

      // Calcul universel du statut d'ouverture en direct
      const modeH = b.mode_horaires || "indiques";
      if (modeH === "toujours_ouvert") {
        pointStatutTooltip = "bg-[#10B981] animate-pulse";
        badgeLive = `<div class="absolute -bottom-1 bg-[#10B981] text-gray-950 text-[7px] font-black uppercase px-1.5 py-0.2 rounded-full border border-white shadow-xs">24/7</div>`;
      } else if (modeH === "sur_rendez_vous") {
        pointStatutTooltip = "bg-sky-400";
        badgeLive = `<div class="absolute -bottom-1 bg-sky-500 text-white text-[7px] font-black uppercase px-1.5 py-0.2 rounded-full border border-white shadow-xs">RDV</div>`;
      } else {
        const st = calculerStatutOuverture(b, b.horaires);
        if (st?.ouvert) {
          pointStatutTooltip = "bg-[#10B981] animate-pulse";
          badgeLive = `<div class="absolute -bottom-1 bg-[#10B981] text-gray-950 text-[7px] font-black uppercase px-1.5 py-0.2 rounded-full border border-white shadow-xs">OUVERT</div>`;
        } else {
          pointStatutTooltip = "bg-rose-500";
          badgeLive = `<div class="absolute -bottom-1 bg-rose-500 text-white text-[7px] font-black uppercase px-1.5 py-0.2 rounded-full border border-white shadow-xs">FERMÉ</div>`;
        }
      }

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

      marqueur.on("click", () => {
        setBoutiqueSelectionnee(b);
        setVueBoutiqueDetails(true);
        carte.flyTo([b.lat, b.lng], 15.5, { duration: 1.1 });
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
  }, [boutiquesAffichees, boutiqueSelectionnee]);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    rafraichirMarqueurs();
  }, [rafraichirMarqueurs, cartePrete]);

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

    marqueurMoiRef.current = L.marker([pos.latitude, pos.longitude], { icon: iconeMoi }).addTo(carte);
    if (animer) {
      carte.flyTo([pos.latitude, pos.longitude], 15.5, { duration: 1.2 });
    } else {
      carte.setView([pos.latitude, pos.longitude], 15.5);
    }
  }, []);
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

          {/* Barre des Avatars Snap Map Défilable Horizontalement */}
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
