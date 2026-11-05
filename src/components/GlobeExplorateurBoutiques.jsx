"use client";

import { useIaAutorisee, MESSAGE_IA_EN_PAUSE } from "@/lib/useIaAutorisee";
import { sansAccent, contientTousLesMots } from "@/lib/texte";
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
import { supabase } from "@/lib/supabase";
import ModalTrouverLivreur from "@/components/ModalTrouverLivreur";
import { useFonctionAutorisee } from "@/lib/useFonctionAutorisee";
import { dataUriAvatarBoutique, svgAvatarBoutique } from "@/lib/avatarBoutique";
import { centrerDansDefileur } from "@/lib/dockDefilement";
import { calculerDecalagesDissociation, DIAMETRE_AVATAR_PX } from "@/lib/dissociationMarqueurs";
import { carte3dActive } from "@/lib/carte3d";
import { brancherDensiteNoms, htmlEpingle, typeEpingle } from "@/lib/epingleCarte";
import { STATIONS_BRT, STATIONS_TER, COULEUR_BRT, COULEUR_TER } from "@/lib/transportSenegal";

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
// Valeurs alignées sur la contrainte CHECK réelle de
// marketplace_stores.categorie_etablissement (migrations
// 20260917020000, 20260925120000, 20260925130000) — pas sante/finance/beaute,
// qui n'existent plus en base depuis la première de ces migrations.
const EMOJI_CATEGORIE_ETABLISSEMENT = {
  point_wave: "💰",
  pharmacie: "💊",
  clinique: "🏥",
  autre: "🏢",
  restaurant: "🍽️",
  fast_food: "🍔",
  malibu: "🥪",
  dibiterie: "🍖",
  jus_boissons: "🥤",
  boulangerie: "🥖",
  patisserie: "🍰",
  beignet_fataya: "🥟",
  barber: "💈",
  tresses: "💇🏾‍♀️",
  parfumerie: "🌸",
  esthetique_ongles: "💅",
  soins_bio: "🌿",
  musculation_fitness: "🏋🏾",
  terrain_foot: "⚽",
  terrain_basket: "🏀",
  alimentation_boutique: "🛒",
  cafe_the: "☕",
  banque_finance: "🏦",
  hotellerie: "🛏️",
  transport_gare: "🚌",
  bus_mobilite: "🚏",
};
const LIBELLES_CATEGORIE_ETABLISSEMENT = {
  point_wave: "Point Wave",
  pharmacie: "Pharmacie",
  clinique: "Clinique",
  autre: "Établissement",
  restaurant: "Restaurant",
  fast_food: "Fast-food",
  malibu: "Malibu",
  dibiterie: "Dibiterie",
  jus_boissons: "Jus & Boissons",
  boulangerie: "Boulangerie",
  patisserie: "Pâtisserie",
  beignet_fataya: "Beignet ak Fataya",
  barber: "Barber",
  tresses: "Tresses",
  parfumerie: "Parfumerie",
  esthetique_ongles: "Esthétique & Ongles",
  soins_bio: "Soins & Bio",
  musculation_fitness: "Musculation / Fitness",
  terrain_foot: "Terrain de foot",
  terrain_basket: "Terrain de basket",
  alimentation_boutique: "Alimentation / Boutique",
  cafe_the: "Café ak Thé",
  banque_finance: "Banque & Finance",
  hotellerie: "Hôtel & Hébergement",
  transport_gare: "Gare & Transport",
  bus_mobilite: "Arrêt de bus",
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

// Trait de rappel d'un marqueur dissocié : SVG posé DANS le marqueur, de
// l'ancre (position réelle) vers l'ancre décalée. Caché tant que le marqueur
// n'est pas déplacé (data-actif="0"), voir appliquerDecalageMarqueur.
function htmlTraitRappel(ancreX, ancreY) {
  return `<svg class="trait-rappel" data-actif="0" width="1" height="1" style="position:absolute;left:0;top:0;overflow:visible;pointer-events:none;display:none;"><line x1="${ancreX}" y1="${ancreY}" x2="${ancreX}" y2="${ancreY}" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.7" stroke-dasharray="2 4" stroke-linecap="round"/></svg>`;
}

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

// Mots que l'analyse d'une photo ajoute souvent et qui ne désignent pas le produit.
const MOTS_TROP_GENERAUX = new Set(["dakar", "senegal", "boutique", "qualite", "disponible", "marketplace", "article", "produit", "promo", "pas", "cher", "neuf", "pour", "avec", "les", "des", "une", "bio"]);

export default function GlobeExplorateurBoutiques({
  boutiques = [],
  tousArticles = [],
  // Appelé (après une courte pause de frappe) avec le texte tapé : le parent cherche alors dans
  // tous les produits de la plateforme et complète tousArticles / boutiques. "" = recherche effacée.
  onRechercheTexte,
  onVoirBoutique,
  onVoirArticle,
  onFermer,
  // Position déjà relevée par le bouton "Autour de moi" du Marketplace
  // (avant même l'ouverture du Globe) : évite de redemander la permission
  // de géolocalisation une seconde fois quand ce composant remplace
  // désormais aussi la carte "Autour de moi" mobile.
  positionInitiale = null,
  // Boutique vers laquelle l'utilisateur veut se rendre : trace l'itinéraire
  // depuis sa position (route serveur, ou ligne droite à défaut).
  itineraireCible: itineraireCibleProp = null,
}) {
  const conteneurRef = useRef(null);
  const carteRef = useRef(null);
  const coucheTuilesRef = useRef(null);
  const groupeMarqueursRef = useRef(null);
  const marqueurMoiRef = useRef(null);
  // Position géographique RÉELLE de "Vous êtes ici", séparée de
  // marqueurMoiRef.getLatLng() qui peut refléter une position décalée par
  // la dissociation automatique (voir recalculerDissociations) — sans
  // cette référence à part, impossible de savoir où le replacer une fois
  // qu'il n'est plus trop proche d'une boutique.
  const positionOrigineMoiRef = useRef(null);
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
  // Clé "lat,lng" de la dernière position auto-centrée pour la carte
  // ACTUELLE (remise à null quand une nouvelle carte est créée, voir
  // l'effet d'initialisation) — évite que les rafales de recentrage
  // automatique (forcerTaille à 50/150/300/600/1200ms + l'effet
  // [positionInitiale, cartePrete] juste en dessous) déclenchent chacune
  // leur propre setView vers la MÊME cible pendant que l'animation de zoom
  // de la précédente est encore en cours. Ces recentrages en cascade
  // faisaient planter Leaflet en interne (TypeError sur _leaflet_pos dans
  // _onZoomTransitionEnd, reproduit en systématique dès l'ouverture
  // d'Explorer avec une position déjà connue) sans jamais casser le rendu
  // React — d'où l'absence de symptôme visible signalé jusqu'ici.
  const dernierePositionAutoRef = useRef(null);
  // true pendant qu'une animation de zoom Leaflet (flyTo/setView) est en
  // cours sur la carte actuelle — posé/retiré via les événements
  // zoomstart/zoomend (voir l'effet d'initialisation). invalidateSize()
  // appelé PENDANT cette fenêtre perturbait l'état interne du pane que
  // Leaflet consulte à la fin de la transition (voir dernierePositionAutoRef
  // ci-dessus pour le contexte complet du correctif).
  const zoomAnimationEnCoursRef = useRef(false);
  const popupsBoutiquesRef = useRef(new Map());
  // Nettoyage de l'écouteur zoomend/moveend qui recalcule la dissociation
  // automatique des boutiques superposées (voir recalculerDissociations
  // dans rafraichirMarqueurs) — même raisonnement que
  // echelleZoomCleanupRef juste en dessous : rafraichirMarqueurs est
  // rappelé à chaque clic/changement de sélection, sans ce nettoyage
  // chaque passage accumulerait un écouteur de plus sur la même carte.
  const dissociationCleanupRef = useRef(null);
  // Rempli par l'effet de la carte : zoome sur le groupe qui cache une boutique.
  const zoomerSurBoutiqueRef = useRef(() => false);
  // Vrai si une autre boutique visible est assez proche pour que la bulle
  // d'info de celle-ci la recouvre (rempli par l'effet de la carte).
  const aDesVoisinsRef = useRef(() => false);
  // Id de la boutique sélectionnée, lisible depuis les gestionnaires Leaflet
  // (créés une fois : l'état React y serait périmé).
  const idSelectionRef = useRef(null);
  // Boutique dont la bulle produits est actuellement "épinglée" (ouverte en
  // permanence suite à un simple clic, jusqu'à un nouveau clic ou un
  // double-clic) — une ref, pas un state : lue depuis des gestionnaires
  // d'événements Leaflet posés une fois par marqueur, pas depuis le rendu.
  const boutiqueEpingleeIdRef = useRef(null);

  const [boutiqueSelectionnee, setBoutiqueSelectionnee] = useState(null);
  // Carte du bas (nom + Itinéraire / Appeler / WhatsApp / Partager) : ouverte seulement quand la personne touche un pin ou une
  // boutique du carrousel, jamais par la sélection automatique de la première boutique au chargement.
  const [ficheCarteOuverte, setFicheCarteOuverte] = useState(false);
  const [filtreActif, setFiltreActif] = useState("tous"); // 'tous' | 'populaires' | 'live'
  const [styleActif, setStyleActif] = useState("voyager"); // plan clair par défaut (22/10/2026) ; .dark. | 'voyager' | 'satellite'
  const [localisationEnCours, setLocalisationEnCours] = useState(false);
  const [erreurLocalisation, setErreurLocalisation] = useState("");
  const [vueBoutiqueDetails, setVueBoutiqueDetails] = useState(false);
  const [cartePrete, setCartePrete] = useState(false);
  const [trajetInfo, setTrajetInfo] = useState(null);
  // Itinéraire demandé depuis le bouton vert des bulles du carrousel (en plus de celui que la page parente peut imposer).
  const [itineraireLocal, setItineraireLocal] = useState(null);
  const itineraireCible = itineraireCibleProp || itineraireLocal;
  // L'itinéraire demandé depuis une bulle survit à l'actualisation de la page (stocké sur l'appareil) ; il disparaît quand on ferme le carrousel ou une bulle.
  const CLE_ITINERAIRE = "facilite:itineraire-carte";
  useEffect(() => {
    try {
      const v = JSON.parse(window.localStorage.getItem(CLE_ITINERAIRE) || "null");
      if (v && Number.isFinite(Number(v.lat)) && Number.isFinite(Number(v.lng))) setItineraireLocal(v);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      if (itineraireLocal) window.localStorage.setItem(CLE_ITINERAIRE, JSON.stringify(itineraireLocal));
      else window.localStorage.removeItem(CLE_ITINERAIRE);
    } catch {}
    if (!itineraireLocal) setTrajetInfo(null);
  }, [itineraireLocal]);

  useEffect(() => {
    if (!itineraireCible || !cartePrete || !carteRef.current) return undefined;
    let annule = false;
    const carte = carteRef.current;
    const couches = [];
    const destination = [Number(itineraireCible.lat), Number(itineraireCible.lng)];

    const obtenirOrigine = () =>
      positionInitiale
        ? Promise.resolve([positionInitiale.latitude, positionInitiale.longitude])
        : new Promise((resoudre, rejeter) => {
            if (!navigator.geolocation) return rejeter(new Error("geoloc"));
            navigator.geolocation.getCurrentPosition(
              (pos) => resoudre([pos.coords.latitude, pos.coords.longitude]),
              rejeter,
              { timeout: 15000, maximumAge: 60000 }
            );
          });

    (async () => {
      try {
        const origine = await obtenirOrigine();
        if (annule) return;
        const { data } = await supabase.auth.getSession();
        const session = data?.session;
        const L = (await import("leaflet")).default;
        if (annule) return;

        let points = [origine, destination];
        let resume = null;
        for (let essai = 0; session && !resume && essai < 2; essai++) {
          try {
            const reponse = await fetch("/api/marketplace/itineraire", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                depart: { lat: origine[0], lng: origine[1] },
                arrivee: { lat: destination[0], lng: destination[1] },
                profil: "pieton",
              }),
            });
            const donnees = reponse.ok ? await reponse.json() : null;
            if (donnees && Array.isArray(donnees.points) && donnees.points.length > 1) {
              points = donnees.points;
              resume = donnees;
            }
          } catch {
            // nouvel essai, puis repli ci-dessous
          }
        }
        if (annule) return;

        if (resume) {
          setTrajetInfo({
            texte: `À pied : ${String(resume.distance_km).replace(".", ",")} km · environ ${resume.duree_min} min`,
          });
        } else {
          const rad = (d) => (d * Math.PI) / 180;
          const dLat = rad(destination[0] - origine[0]);
          const dLng = rad(destination[1] - origine[1]);
          const h =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(rad(origine[0])) * Math.cos(rad(destination[0])) * Math.sin(dLng / 2) ** 2;
          const km = 2 * 6371 * Math.asin(Math.sqrt(h));
          const lisible = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace(".", ",")} km`;
          setTrajetInfo({
            texte: `À vol d'oiseau : ${lisible}`,
            note: session
              ? "Itinéraire routier indisponible pour le moment."
              : "Connecte-toi pour voir l'itinéraire routier.",
          });
        }

        const trace = L.polyline(points, {
          color: "#2563eb",
          weight: 5,
          dashArray: resume ? null : "6 8",
        }).addTo(carte);
        couches.push(trace);
        couches.push(
          L.circleMarker(destination, { radius: 10, color: "#ffffff", weight: 3, fillColor: "#10b981", fillOpacity: 1 }).addTo(carte)
        );
        // Le cadrage automatique ne vaut que pour un itinéraire demandé par la page (« M'y rendre ») ; depuis le bouton d'une bulle, la carte ne bouge pas.
        if (itineraireCibleProp) carte.fitBounds(trace.getBounds(), { padding: [60, 60] });
      } catch {
        if (!annule) setTrajetInfo({ texte: "Position indisponible : autorise la localisation." });
      }
    })();

    return () => {
      annule = true;
      couches.forEach((c) => c.remove());
    };
  }, [itineraireCible, itineraireCibleProp, cartePrete, positionInitiale]);
  const [horaires, setHoraires] = useState([]);
  const [horairesChargement, setHorairesChargement] = useState(false);
  // Recherche mot-clé de la carte (Point C) — filtre local, sur les
  // boutiques/articles déjà chargés par le Marketplace (aucun nouvel appel
  // réseau) : cherche un article ou une boutique, jamais bloquant.
  const [rechercheCarte, setRechercheCarte] = useState("");
  const [scanPhotoEnCours, setScanPhotoEnCours] = useState(false);
  const inputRechercheRef = useRef(null);
  const fileInputPhotoRef = useRef(null);
  const barreRechercheRef = useRef(null);

  // Isole la barre de recherche des gestes Leaflet — même si elle n'est
  // pas un descendant DOM de la carte (elle est un frère du conteneur
  // Leaflet, pas un enfant — comme le dock du carrousel plus bas), un clic
  // dessus reste un geste posé au-dessus de la carte à l'écran, et
  // certains navigateurs mobiles peuvent poser des écouteurs Leaflet plus
  // haut (document) que le seul conteneur carte. disableClickPropagation +
  // disableScrollPropagation sont le garde-fou standard Leaflet pour un
  // contrôle HTML sans logique de glissement propre — PAS appliqué au dock
  // du carrousel : celui-ci a son propre glissement à la souris
  // (onMouseDownCarousel), qui repose sur l'événement natif "mousedown" —
  // exactement celui que disableClickPropagation stoppe. Testé : avec ce
  // garde-fou sur le dock, le glissement à la souris/au doigt ne faisait
  // plus rien du tout (régression confirmée). Signalé par l'utilisateur :
  // cliquer sur la barre de recherche déclenchait un zoom au lieu du focus
  // clavier.
  useEffect(() => {
    const cibles = [barreRechercheRef.current].filter(Boolean);
    if (cibles.length === 0) return;
    let annule = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (annule) return;
      cibles.forEach((el) => {
        L.DomEvent.disableClickPropagation(el);
        L.DomEvent.disableScrollPropagation(el);
      });
    })();
    return () => {
      annule = true;
    };
  }, []);

  // Recherche par photo (IA Scanner Vision) : la route /api/marketplace/scan-product reconnaît le produit
  // (titre commercial long + mots-clés). Un titre complet comme « Crème Hydratante Visage Bio 200ml »
  // ne ressemble à aucun produit de la base : on essaie donc les mots-clés un par un, puis les mots du
  // titre, et on garde le premier qui trouve au moins un produit sur la plateforme.
  const [messageScan, setMessageScan] = useState("");
  const iaAutorisee = useIaAutorisee();
  const handleScanPhotoRecherche = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanPhotoEnCours(true);
    setMessageScan("");
    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/marketplace/scan-product", {
        method: "POST",
        body: formData,
      });
      const json = res.ok ? await res.json() : null;
      const fiche = json?.data;

      // analyse_ia = false : l'IA n'a pas pu analyser la photo, le titre est un texte générique.
      if (!json?.analyse_ia || !fiche?.titre) {
        setMessageScan("Analyse de la photo indisponible pour le moment : tapez le nom du produit.");
        return;
      }

      const motsTitre = String(fiche.titre).split(/\s+/);
      const candidats = [];
      for (const m of [...(fiche.mots_cles || []), ...motsTitre]) {
        const mot = sansAccent(m).replace(/[^a-z0-9 ]/g, "").trim();
        if (mot.length >= 3 && !/^\d/.test(mot) && !MOTS_TROP_GENERAUX.has(mot) && !candidats.includes(mot)) candidats.push(mot);
      }
      let choisi = null;
      for (const c of candidats.slice(0, 8)) {
        const n = onRechercheTexte ? await onRechercheTexte(c) : 0;
        if (n > 0) {
          choisi = c;
          break;
        }
      }
      if (choisi) {
        setRechercheCarte(choisi);
      } else {
        setRechercheCarte(candidats[0] || String(fiche.titre));
        setMessageScan(`Aucun produit similaire à « ${fiche.titre} » pour le moment.`);
      }
    } catch (err) {
      console.warn("Erreur recherche par image:", err);
      setMessageScan("Analyse de la photo impossible : tapez le nom du produit.");
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
  // Touche « Carrousel » de la carte : un toucher ouvre et FIXE la bulle de TOUTES les boutiques affichées (nom, quartier, carrousel de leurs articles) ;
  // un second toucher les ferme toutes. Les refs servent au code Leaflet, qui ne relit pas l'état React.
  const [carrousselCarteOuvert, setCarrousselCarteOuvert] = useState(true); // activé par défaut : les bulles des boutiques sont visibles dès l'entrée dans la carte
  const carrousselCarteOuvertRef = useRef(true);
  const bullesFixesRef = useRef(false);
  const basculerBullesFixesRef = useRef(() => {});
  // Touche « Arbre » : boutiques proches = une bulle chacune, rangées en deux colonnes de part et d'autre d'un tronc relié à leurs épingles (croquis de l'utilisateur).
  const [arbreActif, setArbreActif] = useState(false);
  const arbreActifRef = useRef(false);
  useEffect(() => {
    arbreActifRef.current = arbreActif;
    if (carrousselCarteOuvertRef.current) {
      basculerBullesFixesRef.current(false);
      basculerBullesFixesRef.current(true);
    }
  }, [arbreActif]);
  const carrousselAvantRef = useRef(false);
  useEffect(() => {
    carrousselCarteOuvertRef.current = carrousselCarteOuvert;
    basculerBullesFixesRef.current(carrousselCarteOuvert);
    // Fermeture du carrousel (touche ou croix) : le trajet demandé depuis une bulle est retiré.
    if (carrousselAvantRef.current && !carrousselCarteOuvert) setItineraireLocal(null);
    carrousselAvantRef.current = carrousselCarteOuvert;
  }, [carrousselCarteOuvert]);
  // Article individuellement actif dans le dock "Articles" — distinct de
  // boutiqueSelectionnee (qui ne retient que la boutique) : sans état
  // dédié, deux articles d'une même boutique s'affichaient tous les deux
  // comme "sélectionnés" et les flèches n'avaient aucun élément précis à
  // faire défiler jusqu'au centre.
  const [articleActif, setArticleActif] = useState(null);
  const carouselContainerRef = useRef(null);
  // Mesurés pour éviter que la bulle produits (survol d'un avatar) ne
  // s'ouvre sous l'en-tête (recherche + filtres, hauteur variable) ou sous
  // le dock du bas — voir ouvrirBulle.
  const headerRef = useRef(null);
  const dockRef = useRef(null);
  // Hauteur réelle de l'en-tête (varie avec le nombre de rangées de
  // pastilles) : les contrôles flottants de droite (position/zoom/thème) se
  // positionnent juste en dessous plutôt qu'à un décalage deviné, sinon
  // l'ajout d'une rangée de filtres les fait à nouveau chevaucher — capture
  // écran réelle de l'utilisateur montrant ce chevauchement après l'ajout de
  // la barre de catégories.
  // 150 = repli raisonnable le temps que ResizeObserver mesure une première
  // fois (en-tête à 2 rangées de pastilles) ; jamais 0, qui ferait flasher
  // les contrôles collés en haut de l'écran avant la première mesure.
  const [hauteurEntete, setHauteurEntete] = useState(150);
  useEffect(() => {
    if (!headerRef.current || typeof ResizeObserver === "undefined") return;
    const observateur = new ResizeObserver(([entree]) => {
      setHauteurEntete(entree.contentRect.height);
    });
    observateur.observe(headerRef.current);
    return () => observateur.disconnect();
  }, []);

  // Glisser-déposer à la souris pour les deux rangées de pastilles du haut
  // (catégories, puis Toutes/Populaires/LIVE/Autour de moi) : à la souris
  // (pas de trackpad ni écran tactile), overflow-x-auto seul ne se fait
  // défiler qu'au clic-glissé de la barre de scroll elle-même ou à
  // Maj+molette — aucun des deux n'est découvrable. Ref générique (une
  // rangée à la fois glissée) plutôt qu'un ref par rangée : même geste,
  // jamais engagé sur les deux en même temps.
  const dragPastillesRef = useRef({ actif: false, cible: null, depart: 0, scrollDepart: 0 });
  const onMouseDownPastilles = (e) => {
    const cible = e.currentTarget;
    dragPastillesRef.current = { actif: true, cible, depart: e.pageX, scrollDepart: cible.scrollLeft };
  };
  const onMouseMovePastilles = (e) => {
    const etat = dragPastillesRef.current;
    if (!etat.actif || !etat.cible) return;
    etat.cible.scrollLeft = etat.scrollDepart - (e.pageX - etat.depart);
  };
  const onMouseUpPastilles = () => {
    dragPastillesRef.current.actif = false;
  };

  const defilerCarrousel = (direction) => {
    if (carouselContainerRef.current) {
      const decallage = direction === "gauche" ? -180 : 180;
      carouselContainerRef.current.scrollBy({ left: decallage, behavior: "smooth" });
    }
  };

  // Gestion du glissement à la souris et au toucher (Drag to scroll)
  const dragRef = useRef({ isDown: false, startX: 0, scrollLeft: 0, hasMoved: false });

  const onMouseDownCarousel = (e) => {
    if (!carouselContainerRef.current) return;
    dragRef.current.isDown = true;
    dragRef.current.startX = e.pageX - carouselContainerRef.current.offsetLeft;
    dragRef.current.scrollLeft = carouselContainerRef.current.scrollLeft;
    dragRef.current.hasMoved = false;
  };

  const onMouseMoveCarousel = (e) => {
    if (!dragRef.current.isDown || !carouselContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - carouselContainerRef.current.offsetLeft;
    const walk = (x - dragRef.current.startX) * 1.5;
    if (Math.abs(walk) > 4) {
      dragRef.current.hasMoved = true;
    }
    carouselContainerRef.current.scrollLeft = dragRef.current.scrollLeft - walk;
  };

  const onMouseUpCarousel = () => {
    dragRef.current.isDown = false;
  };

  // Filtrer les boutiques avec coordonnées valides
  const marqueurs = useMemo(() => {
    return boutiques.filter(
      (b) => Number.isFinite(b.lat) && Number.isFinite(b.lng) && (b.lat !== 0 || b.lng !== 0)
    );
  }, [boutiques]);

  // Sélectionne par défaut la 1ère boutique pour activer immédiatement l'anneau blanc façon Lens Snapchat (Capture 1)
  useEffect(() => {
    if (!boutiqueSelectionnee && marqueurs.length > 0) {
      setBoutiqueSelectionnee(marqueurs[0]);
    }
  }, [marqueurs, boutiqueSelectionnee]);

  // Recentre le dock sur la boutique sélectionnée, quelle que soit l'origine de
  // la sélection (clic sur la carte, flèches, avatar du dock). Avant, seul un
  // clic DANS le dock le faisait défiler : choisir une boutique sur la carte
  // laissait le carrousel où il était.
  const idBoutiqueSelectionnee = boutiqueSelectionnee?.id;
  useEffect(() => {
    idSelectionRef.current = idBoutiqueSelectionnee ?? null;
  }, [idBoutiqueSelectionnee]);
  useEffect(() => {
    if (!idBoutiqueSelectionnee || vueCarrousel !== "boutiques") return;
    // Après la mise à jour de l'affichage : le nom sous l'avatar sélectionné
    // change la largeur des cases ; mesurer avant faisait d'abord reculer le
    // dock puis l'avancer (va-et-vient mesuré : 54 -> 38 -> 106).
    let image2 = 0;
    const image1 = requestAnimationFrame(() => {
      image2 = requestAnimationFrame(() => {
        const dock = carouselContainerRef.current;
        const cible = dock?.querySelector(`[data-boutique-id="${idBoutiqueSelectionnee}"]`);
        centrerDansDefileur(dock, cible);
      });
    });
    return () => {
      cancelAnimationFrame(image1);
      cancelAnimationFrame(image2);
    };
  }, [idBoutiqueSelectionnee, vueCarrousel]);

  const selectionnerBoutiqueCarousel = (b, element = null) => {
    if (dragRef.current.hasMoved) return;
    setBoutiqueSelectionnee(b);
    setFicheCarteOuverte(true);
    const handler = popupsBoutiquesRef.current.get(b.id);
    if (handler?.ouvrir && !aDesVoisinsRef.current(b.id)) {
      handler.ouvrir();
    } else {
      carteRef.current?.closePopup();
    }
    // Recentre sans imposer de niveau de zoom précis — un flyTo à un zoom
    // fixe à chaque sélection (boutique OU article) dé-zoomait si on avait
    // zoomé plus, zoomait fort si on était dé-zoomé, et donnait une
    // impression de saccade/zoom à chaque déplacement dans le carrousel
    // d'articles. Demande explicite de l'utilisateur ("ça devrait être
    // comme Snap[chat]", pas de mouvement de caméra à chaque changement).
    if (!zoomerSurBoutiqueRef.current(b.id)) {
      carteRef.current?.panTo([b.lat, b.lng], { animate: true, duration: 0.8 });
    }
    // Les flèches précédent/suivant (allerBoutiquePrecedente/Suivante)
    // n'ont pas d'élément DOM sous la main (pas de clic direct sur un
    // avatar) — sans ce repli, la sélection bouclait bien côté données
    // (carte, popup) mais le dock restait scrollé où il était, donnant
    // l'impression que le bouclage n'existait pas. Signalé par
    // l'utilisateur ("ça doit faire le tour").
    // Le recentrage du dock est fait par l'effet sur idBoutiqueSelectionnee
    // (une seule fois, après mise à jour de l'affichage) : le faire ici aussi
    // mesurait l'ancienne mise en page et provoquait un recul visible.
    void element;
  };

  const selectionnerArticleCarousel = (a, element = null) => {
    if (dragRef.current.hasMoved) return;
    setArticleActif(a);
    const bId = a.boutique_id || a.boutiqueId || a.boutique?.id;
    const bNom = (a.boutique_nom || a.boutiqueNom || a.boutique?.nom || "").trim().toLowerCase();
    const boutiqueAssociee = marqueurs.find(
      (b) => (bId && String(b.id) === String(bId)) || (bNom && (b.nom || "").trim().toLowerCase() === bNom)
    );
    if (boutiqueAssociee) {
      // null pour l'élément boutique : le dock affiché est celui des
      // articles (carouselContainerRef pointe dessus), pas celui des
      // boutiques — un data-boutique-id n'y existe pas, la recherche de
      // repli échoue sans effet de bord.
      selectionnerBoutiqueCarousel(boutiqueAssociee, null);
    }
    const cibleArticle = element || carouselContainerRef.current?.querySelector(`[data-article-id="${a.id}"]`);
    centrerDansDefileur(carouselContainerRef.current, cibleArticle);
  };

  const allerBoutiquePrecedente = () => {
    if (marqueurs.length === 0) return;
    const indexActuel = marqueurs.findIndex((b) => b.id === (boutiqueSelectionnee?.id || marqueurs[0]?.id));
    const indexPrecedent = indexActuel > 0 ? indexActuel - 1 : marqueurs.length - 1;
    const prevB = marqueurs[indexPrecedent];
    if (prevB) selectionnerBoutiqueCarousel(prevB);
  };

  const allerBoutiqueSuivante = () => {
    if (marqueurs.length === 0) return;
    const indexActuel = marqueurs.findIndex((b) => b.id === (boutiqueSelectionnee?.id || marqueurs[0]?.id));
    const indexSuivant = indexActuel < marqueurs.length - 1 ? indexActuel + 1 : 0;
    const nextB = marqueurs[indexSuivant];
    if (nextB) selectionnerBoutiqueCarousel(nextB);
  };

  const rechercheNormalisee = sansAccent(rechercheCarte.trim());
  const rechercheActiveRef = useRef(false);
  useEffect(() => {
    rechercheActiveRef.current = rechercheNormalisee.length > 0;
  }, [rechercheNormalisee]);

  useEffect(() => {
    if (!onRechercheTexte) return;
    if (rechercheNormalisee.length < 2) {
      onRechercheTexte("");
      return;
    }
    const minuteur = setTimeout(() => onRechercheTexte(rechercheNormalisee), 350);
    return () => clearTimeout(minuteur);
  }, [rechercheNormalisee, onRechercheTexte]);

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
    return tousArticles.filter((a) =>
      contientTousLesMots(`${a.titre || ""} ${a.description || ""} ${a.categorie || ""} ${a.boutique_nom || ""}`, rechercheNormalisee)
    );
  }, [tousArticles, rechercheNormalisee]);

  // Dès qu'une recherche trouve des produits, le dock montre les PRODUITS (onglet Articles) : toucher
  // un produit centre la carte sur sa boutique. Recherche effacée : retour aux boutiques.
  const rechercheActiveAvecResultats = rechercheNormalisee.length >= 2 && articlesFiltres.length > 0;
  const basculeSurArticlesRef = useRef(false);
  useEffect(() => {
    if (rechercheActiveAvecResultats && !basculeSurArticlesRef.current) {
      basculeSurArticlesRef.current = true;
      queueMicrotask(() => setVueCarrousel("articles"));
    } else if (!rechercheNormalisee && basculeSurArticlesRef.current) {
      basculeSurArticlesRef.current = false;
      queueMicrotask(() => setVueCarrousel("boutiques"));
    }
  }, [rechercheActiveAvecResultats, rechercheNormalisee]);

  // Recherche d'un produit : photo du premier article trouvé de chaque boutique, affichée sur son rond.
  const photosArticlesRecherche = useMemo(() => {
    const m = new Map();
    if (!rechercheNormalisee) return m;
    articlesFiltres.forEach((a) => {
      const chemin = a.photos?.[0];
      if (a.boutique_id && chemin && !m.has(a.boutique_id)) m.set(a.boutique_id, urlPhoto(chemin));
    });
    return m;
  }, [articlesFiltres, rechercheNormalisee]);

  const idsBoutiquesArticlesFiltres = useMemo(
    () => new Set(articlesFiltres.map((a) => a.boutique_id).filter(Boolean)),
    [articlesFiltres]
  );

  // Article réellement affiché comme actif dans le dock "Articles" : celui
  // choisi explicitement (articleActif) s'il existe toujours dans la liste
  // filtrée, sinon le premier — calculé directement au rendu (pas via un
  // useEffect + setState, qui cassait la mémoisation d'articlesFiltres
  // pour tout le composant). Même convention que la sélection par défaut
  // de la 1ère boutique plus haut : sans repli, aucun anneau blanc ne
  // s'affichait tant qu'aucun clic direct n'avait eu lieu, ni après un
  // filtre de recherche qui fait disparaître l'article actif.
  const articleActifEffectif = useMemo(() => {
    if (articleActif && articlesFiltres.some((a) => a.id === articleActif.id)) {
      return articleActif;
    }
    return articlesFiltres[0] || null;
  }, [articleActif, articlesFiltres]);

  // Équivalents de allerBoutiquePrecedente/Suivante ci-dessus, mais pour le
  // dock "Articles" (vueCarrousel === "articles") : les flèches appelaient
  // jusqu'ici toujours allerBoutique*, qui cherche un [data-boutique-id]
  // absent de ce dock — la sélection changeait bien côté données mais rien
  // ne défilait à l'écran. Signalé par l'utilisateur.
  const allerArticlePrecedent = () => {
    if (articlesFiltres.length === 0) return;
    const indexActuel = articlesFiltres.findIndex(
      (a) => a.id === (articleActifEffectif?.id || articlesFiltres[0]?.id)
    );
    const indexPrecedent = indexActuel > 0 ? indexActuel - 1 : articlesFiltres.length - 1;
    const prevA = articlesFiltres[indexPrecedent];
    if (prevA) selectionnerArticleCarousel(prevA);
  };

  const allerArticleSuivant = () => {
    if (articlesFiltres.length === 0) return;
    const indexActuel = articlesFiltres.findIndex(
      (a) => a.id === (articleActifEffectif?.id || articlesFiltres[0]?.id)
    );
    const indexSuivant = indexActuel < articlesFiltres.length - 1 ? indexActuel + 1 : 0;
    const nextA = articlesFiltres[indexSuivant];
    if (nextA) selectionnerArticleCarousel(nextA);
  };

  // Flèches gauche/droite du clavier -> même navigation que les boutons
  // fléchés du dock. Ignoré si le focus est dans un champ de saisie (la
  // barre de recherche, notamment) : les flèches y déplacent le curseur
  // texte, pas le carrousel. Demande explicite de l'utilisateur.
  useEffect(() => {
    const gestionnaire = (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const actif = document.activeElement;
      const focusDansChampTexte =
        actif && (actif.tagName === "INPUT" || actif.tagName === "TEXTAREA" || actif.isContentEditable);
      if (focusDansChampTexte) return;
      e.preventDefault();
      if (vueCarrousel === "boutiques") {
        if (e.key === "ArrowLeft") allerBoutiquePrecedente();
        else allerBoutiqueSuivante();
      } else {
        if (e.key === "ArrowLeft") allerArticlePrecedent();
        else allerArticleSuivant();
      }
    };
    window.addEventListener("keydown", gestionnaire);
    return () => window.removeEventListener("keydown", gestionnaire);
  });

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
      (b) => contientTousLesMots(b.nom, rechercheNormalisee) || idsBoutiquesArticlesFiltres.has(b.id)
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
                const handler = popupsBoutiquesRef.current.get(b.id);
                if (handler?.ouvrir) {
                  handler.ouvrir();
                }
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
  const [livreursOuverts, setLivreursOuverts] = useState(false);
  // « Trouver un livreur » : en pause pour le public (interrupteur nav_marketplace_livreur).
  const livreurAutorise = useFonctionAutorisee("nav_marketplace_livreur");
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
    // Nouvelle carte à venir : aucun recentrage auto n'a encore eu lieu
    // pour elle (voir dernierePositionAutoRef plus haut).
    dernierePositionAutoRef.current = null;

    (async () => {
      if (!conteneurRef.current) return;
      try {
        const L = (await import("leaflet")).default;
        if (annule || !conteneurRef.current) return;

        // Détruire ancienne carte si existante. Cause racine confirmée en
        // lisant node_modules/leaflet/dist/leaflet-src.js : une animation de
        // zoom (déclenchée par setView, ex. l'auto-centrage sur "Vous êtes
        // ici" juste avant que `marqueurs` ne change et ne redéclenche cet
        // effet) programme un setTimeout de secours de 250ms qui rappelle
        // _onZoomTransitionEnd quoi qu'il arrive ; ce handler ne vérifie que
        // `_animatingZoom`, jamais `_mapPane` avant d'appeler _move(). Or
        // remove() supprime _mapPane SANS repasser _animatingZoom à false
        // ni annuler ce timer — 250ms plus tard, le rappel s'exécute sur un
        // pane déjà détruit (TypeError _leaflet_pos, reproduit de façon
        // fiable). stop() (flyTo/panTo) ne couvre pas ce cas ; on neutralise
        // donc directement le drapeau avant remove().
        if (carteRef.current) {
          carteRef.current.stop();
          carteRef.current._animatingZoom = false;
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
        // Les bulles d'info passent SOUS les marqueurs (Leaflet : bulles 700,
        // marqueurs 600 par défaut). Au-dessus, la bulle de la boutique
        // sélectionnée recouvrait les avatars voisins et un tap tombait sur
        // elle au lieu de la boutique visée (mesuré). « Vous êtes ici »
        // (pane 640) reste au-dessus de tout.
        carte.getPane("popupPane").style.zIndex = 590;
        carte.on("zoomstart", () => {
          zoomAnimationEnCoursRef.current = true;
        });
        carte.on("zoomend", () => {
          zoomAnimationEnCoursRef.current = false;
        });
        brancherDensiteNoms(carte);

        // URL de tuiles propre sans paramètre erroné
        const urlTuiles = styleActif === "satellite" ? TUILES_SATELLITE : TUILES_OSM;

        // 18, pas 19 : à ce niveau, la couverture OpenStreetMap de zones
        // moins densément cartographiées (ex. banlieues de Dakar) peut ne
        // proposer aucune tuile réelle, laissant un fond gris vide — confirmé
        // par capture d'écran réelle. Même plafond que CarteBoutiques.jsx.
        const couche = L.tileLayer(urlTuiles, {
          maxZoom: 18,
          crossOrigin: true,
        }).addTo(carte);

        coucheTuilesRef.current = couche;
        groupeMarqueursRef.current = L.layerGroup().addTo(carte);

        // Limites et noms des 14 régions du Sénégal (OCHA / geoBoundaries, CC BY 3.0 IGO) : contour coloré en
        // pointillés, léger voile, nom au centre de chaque région. Chargées à part (fichier de 27 Ko).
        import("@/lib/regionsCarte.json").then((m) => {
          if (!carte || carte._regionsAjoutees || !carte.getContainer()?.isConnected) return;
          carte._regionsAjoutees = true;
          if (!carte.getPane("regions")) {
            carte.createPane("regions");
            carte.getPane("regions").style.zIndex = 250;
          }
          carte.attributionControl?.addAttribution("Limites : OCHA / geoBoundaries");
          const PALETTE = ["#38BDF8", "#F59E0B", "#34D399", "#F472B6", "#A78BFA", "#FB923C", "#2DD4BF", "#FACC15", "#60A5FA", "#F87171", "#4ADE80", "#C084FC", "#22D3EE", "#FDBA74"];
          (m.default || m).forEach((r, i) => {
            const c = PALETTE[i % PALETTE.length];
            L.polygon(r.poly, { pane: "regions", color: c, weight: 1.8, opacity: 0.9, dashArray: "6 5", fillColor: c, fillOpacity: 0.07, interactive: false }).addTo(carte);
            L.marker(r.centre, {
              icon: L.divIcon({
                className: "",
                html: `<span style="display:block;width:140px;text-align:center;font:800 11px system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap;color:rgba(255,255,255,.7);text-shadow:0 1px 3px rgba(0,0,0,.9),0 0 6px rgba(0,0,0,.6);pointer-events:none">${echapperHtml(r.nom)}</span>`,
                iconSize: [140, 16],
                iconAnchor: [70, 8],
              }),
              interactive: false,
              keyboard: false,
              zIndexOffset: -1000,
            }).addTo(carte);
          });
        });

        // Repères réels de transport public (BRT, TER) — couche de référence
        // statique, jamais issue de marketplace_stores (pas des boutiques,
        // personne n'en est "propriétaire" sur Facilité). Voir
        // src/lib/transportSenegal.js pour la source des coordonnées.
        // Les stations sont dessinées sur un canevas : dans le pane des marqueurs (600) il recouvrait TOUTE la carte au-dessus des bulles (590) et interceptait leurs touchers
        // (défilement des articles impossible). Pane dédié à 585 : sous les bulles et sous les épingles.
        if (!carte.getPane("stations")) carte.createPane("stations").style.zIndex = 585;
        const coucheTransport = L.layerGroup().addTo(carte);
        const ajouterStationTransport = (station, couleur, reseau) => {
          L.circleMarker([station.lat, station.lng], {
            radius: 5,
            weight: 2,
            color: "#ffffff",
            fillColor: couleur,
            fillOpacity: 0.95,
            pane: "stations",
          })
            .bindPopup(`<strong>${reseau}</strong><br>${echapperHtml(station.nom)}`)
            .addTo(coucheTransport);
        };
        STATIONS_BRT.forEach((s) => ajouterStationTransport(s, COULEUR_BRT, "🚌 BRT"));
        STATIONS_TER.forEach((s) => ajouterStationTransport(s, COULEUR_TER, "🚆 TER"));

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
            if (!zoomAnimationEnCoursRef.current) {
              carte.invalidateSize({ pan: false });
            }
            setCartePrete(true);
            rafraichirMarqueursRef.current();
            // Pendant une recherche, le recentrage sur les résultats prime sur « Vous êtes ici ».
            if (positionInitiale && !rechercheActiveRef.current) {
              const cle = `${positionInitiale.latitude},${positionInitiale.longitude}`;
              if (dernierePositionAutoRef.current !== cle) {
                dernierePositionAutoRef.current = cle;
                centrerSurPositionRef.current(positionInitiale, { animer: false });
              }
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
        // stop() + _animatingZoom=false avant remove() : voir le
        // commentaire détaillé plus haut (destruction de l'ancienne carte)
        // — c'est CETTE fonction de nettoyage, pas le bloc "détruire
        // ancienne carte" du corps de l'effet, qui s'exécute réellement
        // quand `marqueurs`/`styleActif` changent (React nettoie
        // l'exécution précédente avant de relancer le corps de l'effet).
        carteRef.current.stop();
        carteRef.current._animatingZoom = false;
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
      positionOrigineMoiRef.current = null;
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
    // Touche « Carrousel » active : les bulles fixées de l'ancienne génération de marqueurs sont fermées avant l'effacement ; les nouvelles sont rouvertes plus bas.
    if (bullesFixesRef.current) basculerBullesFixesRef.current(false);
    groupe.clearLayers();

    // Boutiques à la même position réelle (ou trop proches à l'écran) :
    // dissociées AUTOMATIQUEMENT en anneau autour du barycentre du groupe,
    // reliées chacune par un trait fin à leur position géographique réelle
    // — pattern "marqueur éclaté relié par une ligne", nécessaire pour
    // rester lisible (avatars/étiquettes/bouton d'action superposés sinon
    // — confirmé par capture d'écran réelle à Guinaw Rail Nord). Calcul PUR
    // dans src/lib/dissociationMarqueurs.js : seuil = diamètre d'avatar ×
    // échelle, rayon selon le nombre de membres, anneaux concentriques
    // au-delà de 8 (l'ancien rayon fixe de 30 px laissait des avatars
    // superposés dès 4 membres ; mesuré : 18,9 px entre voisins pour 10).
    //
    // DÉCALAGE EN PIXELS APPLIQUÉ AU CONTENU du marqueur (transform CSS sur
    // .marqueur-decale-contenu), jamais à sa position géographique : le
    // marqueur reste à sa vraie coordonnée. Avant, les marqueurs étaient
    // déplacés en latlng à chaque zoomend : pendant un geste de zoom le
    // rayon de l'anneau grossissait avec la carte (×2 par niveau) puis se
    // recalait d'un coup au relâchement (saut mesuré de 36 px). Un
    // décalage en pixels constants suit la carte sans dériver ; le calcul
    // ne dépend que du zoom et est refait sur zoomanim (zoom CIBLE, dès le
    // début du geste), zoom (vol, pincement) et zoomend. Le trait de rappel
    // est un SVG DANS le marqueur : il se déplace avec lui, sans redessin
    // de calque Leaflet.
    const marqueursCreesParId = new Map();

    function appliquerDecalageMarqueur(entree, dx, dy) {
      const decale = Math.hypot(dx, dy) >= 0.5;
      entree.decalage = { dx: decale ? dx : 0, dy: decale ? dy : 0 };
      // Poussé vers le bas (l'axe Y écran croît vers le bas) : sa bulle par
      // défaut (ouverte vers le haut) recouvrirait l'autre boutique juste
      // au-dessus — ouvrirBulle la décale sur le côté à la place. Signalé
      // par l'utilisateur avec une capture réelle des deux avatars empilés.
      entree.decalageBas = decale && dy > 0;
      const el = entree.marqueur.getElement();
      if (el) {
        const contenu = el.querySelector(".marqueur-decale-contenu");
        const trait = el.querySelector(".trait-rappel");
        if (contenu) contenu.style.transform = decale ? `translate(${dx}px, ${dy}px)` : "";
        if (trait) {
          const ligne = trait.firstElementChild;
          if (decale && ligne) {
            ligne.setAttribute("x2", String(entree.ancre[0] + dx));
            ligne.setAttribute("y2", String(entree.ancre[1] + dy));
          }
          trait.style.display = decale ? "" : "none";
          trait.dataset.actif = decale ? "1" : "0";
        }
      }
      entree.rafraichirPopup?.();
    }

    // REGROUPEMENT EN BULLES (retour utilisateur du 12/10/2026 : au dézoom, la
    // dissociation en anneau écartait les avatars loin de leur vraie place —
    // certains au milieu de la mer, reliés par des traits pointillés — « la
    // façon dont elles se dispersent ne me plaît pas »). Des boutiques
    // GÉOGRAPHIQUEMENT distinctes qui se recouvrent à l'écran sont maintenant
    // remplacées par UNE bulle portant leur nombre, posée au barycentre ; un
    // appui zoome sur le groupe et elles se séparent d'elles-mêmes. L'anneau
    // relié par des traits n'est conservé que pour les boutiques situées
    // vraiment au même endroit (même immeuble, même marché) : elles ne se
    // séparent jamais, quel que soit le zoom.
    const ZOOM_SEPARATION = 18;
    // 01/11/2026 : au dézoom (< 16), les boutiques qui se touchent deviennent UN point numéroté (cliquer = zoomer dessus) ; les boutiques isolées restent fixes sur leur position.
    const REGROUPER_EN_BULLES = false; // 01/11/2026 : l'utilisateur refuse tout regroupement en chiffre
    const ZOOM_ANNEAU = 12; // 67 % sur la barre de zoom : dès ce niveau, les épingles qui se recouvrent sont écartées côte à côte (taille et position de base inchangées)
    // 02/11/2026 : les épingles ne quittent JAMAIS leur position (ni écartement en cercle, ni rosette) ; chaque boutique garde sa propre bulle (aucune fusion) sauf avec la touche « Arbre ».
    const SEPARER_BOUTIQUES_PROCHES = false;
    let bullesActives = [];
    let signatureBulles = "";
    const groupeDeBoutique = new Map(); // id boutique -> ids du groupe (regroupé)

    function majorationSeparable(ids) {
      // Séparable = au zoom maximal, au moins deux membres restent distants
      // de plus d'un diamètre d'avatar : zoomer les sépare réellement.
      const pts = ids
        .map((id) => marqueursCreesParId.get(id)?.marqueur?.getLatLng())
        .filter(Boolean)
        .map((ll) => carte.project(ll, ZOOM_SEPARATION));
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          if (Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) > DIAMETRE_AVATAR_PX * 1.1) return true;
        }
      }
      return false;
    }

    function afficherBulle(ids) {
      const membres = ids.map((id) => marqueursCreesParId.get(id)?.marqueur?.getLatLng()).filter(Boolean);
      const lat = membres.reduce((t, ll) => t + ll.lat, 0) / membres.length;
      const lng = membres.reduce((t, ll) => t + ll.lng, 0) / membres.length;
      const icone = L.divIcon({
        className: "bulle-regroupement",
        html: `<div style="width:46px;height:46px;border-radius:9999px;background:#10B981;color:#04130d;border:3px solid #fff;box-shadow:0 0 0 6px rgba(16,185,129,.28),0 6px 16px rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;font:800 17px system-ui,sans-serif;cursor:pointer">${ids.length}</div>`,
        iconSize: [46, 46],
        iconAnchor: [23, 23],
      });
      const bulle = L.marker([lat, lng], { icon: icone, zIndexOffset: 500, keyboard: false, title: `${ids.length} boutiques` });
      bulle.on("click", (e) => {
        if (e?.originalEvent) e.originalEvent.stopPropagation();
        carte.fitBounds(L.latLngBounds(membres), { padding: [70, 70], maxZoom: ZOOM_SEPARATION, animate: true, duration: 0.5 });
      });
      bulle.addTo(groupe);
      bullesActives.push(bulle);
    }

    // Épingles qui se recouvrent : UN marqueur posé sur leur position, avec la tête de profil de CHAQUE boutique côte à côte (4 têtes pour 4 boutiques). Position et taille fixes ;
    // chaque tête est cliquable et agit comme l'épingle de sa boutique. Dès que les épingles ne se recouvrent plus, elles redeviennent des épingles.
    function dessinerTetesGroupees(zoomCalcul = carte.getZoom()) {
      // Groupes GÉOGRAPHIQUES : les boutiques à 100 m ou moins les unes des autres. Ils ne dépendent donc plus du zoom : la fleur reste la même (mêmes têtes, même taille, même place) à tous les niveaux, et
      // n'est reconstruite que si le groupe lui-même change (nouvelle boutique, boutique retirée) ou si les épingles ont été recréées.
      const liste = boutiquesAffichees.filter((b) => Number.isFinite(b.lat) && Number.isFinite(b.lng));
      const parent = liste.map((_, i) => i);
      const racine = (i) => {
        while (parent[i] !== i) {
          parent[i] = parent[parent[i]];
          i = parent[i];
        }
        return i;
      };
      for (let i = 0; i < liste.length; i++) {
        for (let j = i + 1; j < liste.length; j++) {
          if (carte.distance([liste[i].lat, liste[i].lng], [liste[j].lat, liste[j].lng]) <= 100) parent[racine(i)] = racine(j);
        }
      }
      const parRacine = new Map();
      liste.forEach((b, i) => {
        const r = racine(i);
        if (!parRacine.has(r)) parRacine.set(r, []);
        parRacine.get(r).push(b.id);
      });
      const groupesCoeur = [...parRacine.values()].filter((ids) => ids.length > 1);
      // En dézoomant, une boutique dont l'épingle TOUCHE la fleur la rejoint (sa tête s'ajoute ; la taille et la place de la fleur ne changent pas). Le centre de la fleur est celui du noyau à 100 m.
      const centreNoyau = (ids) => {
        const ll = ids.map((id) => liste.find((b) => b.id === id)).map((b) => L.latLng(b.lat, b.lng));
        let noyau = ll;
        let meilleur = -1;
        ll.forEach((u) => {
          const voisines = ll.filter((v) => carte.distance(u, v) <= 100);
          if (voisines.length > meilleur) {
            meilleur = voisines.length;
            noyau = voisines;
          }
        });
        return L.latLng(noyau.reduce((t, x) => t + x.lat, 0) / noyau.length, noyau.reduce((t, x) => t + x.lng, 0) / noyau.length);
      };
      const dansUnGroupe = new Set(groupesCoeur.flat());
      const centresPx = groupesCoeur.map((ids) => carte.project(centreNoyau(ids), zoomCalcul));
      const groupes = groupesCoeur.map((ids) => ids.slice());
      liste.forEach((b) => {
        if (dansUnGroupe.has(b.id)) return;
        const pt = carte.project([b.lat, b.lng], zoomCalcul);
        const k = centresPx.findIndex((c) => Math.hypot(c.x - pt.x, c.y - pt.y) < 62);
        if (k >= 0) groupes[k].push(b.id);
      });
      carte.__groupesFleurs = groupes; // noyau d'abord (le premier est le chef du groupe), puis les boutiques qui ont rejoint la fleur
      const signature = groupes.map((g) => g.slice().sort().join("+")).sort().join("|");
      const toutesMasquees = groupes.flat().every((id) => marqueursCreesParId.get(id)?.marqueur?.getElement?.()?.dataset?.masqueTetes === "1");
      if (carte.__signatureTetes === signature && toutesMasquees && carte.__coucheTetes) {
        // La fleur existe déjà : on remasque seulement les épingles de ses boutiques (le code qui précède vient de toutes les réafficher).
        groupes.flat().forEach((id) => {
          const el = marqueursCreesParId.get(id)?.marqueur?.getElement?.();
          if (el) el.style.display = "none";
        });
        return;
      }
      carte.__signatureTetes = signature;
      if (!carte.__coucheTetes) carte.__coucheTetes = L.layerGroup().addTo(carte);
      const coucheTetes = carte.__coucheTetes;
      coucheTetes.clearLayers();
      marqueursCreesParId.forEach((e) => {
        const el = e.marqueur.getElement?.();
        if (el && el.dataset.masqueTetes === "1") {
          el.style.display = "";
          delete el.dataset.masqueTetes;
        }
      });
      groupes.forEach((ids) => {
        const membres = ids.map((id) => ({ id, entree: marqueursCreesParId.get(id) })).filter((m) => m.entree?.marqueur?.getElement?.());
        if (membres.length < 2) return;
        // En FLEUR (inspiration donnée par l'utilisateur) : un cœur sombre posé sur la vraie position, des pétales jaunes qui rayonnent autour, et la tête de profil de chaque boutique au bout de son pétale.
        const TAILLE = 18;
        const n = membres.length;
        // Taille FIXE : le même rayon pour 2 à 7 boutiques (il ne grandit que s'il y en a plus de 7, pour que les têtes ne se chevauchent pas).
        const R = Math.max(26, Math.ceil((TAILLE + 2) / (2 * Math.sin(Math.PI / Math.max(n, 8)))));
        const cote = 2 * (R + TAILLE / 2 + 5);
        const c0 = cote / 2;
        const tetes = membres.map((m) => {
          const el = m.entree.marqueur.getElement();
          const pin = el.querySelector(".epingle-pin");
          const couleur = pin?.querySelector("svg path")?.getAttribute("fill") || "#10B981";
          const contenu = pin?.children?.[1]?.innerHTML || "";
          return { id: m.id, couleur, contenu, el };
        });
        const petales = tetes
          .map((t, i) => {
            const ang = -90 + (360 * i) / n;
            return `<div style="position:absolute;left:${c0}px;top:${c0}px;width:${R - 5}px;height:10px;margin-top:-5px;transform-origin:0 50%;transform:rotate(${ang}deg);background:linear-gradient(90deg,#FDE047,#FACC15);border-radius:60% 60% 60% 60% / 50%;border:1px solid rgba(161,98,7,.45);box-shadow:0 2px 4px rgba(0,0,0,.25);"></div>`;
          })
          .join("");
        const visages = tetes
          .map((t, i) => {
            const ang = ((-90 + (360 * i) / n) * Math.PI) / 180;
            const x = c0 + R * Math.cos(ang) - TAILLE / 2;
            const y = c0 + R * Math.sin(ang) - TAILLE / 2;
            return `<div data-tete="${echapperHtml(String(t.id))}" title="${echapperHtml((boutiquesAffichees.find((b) => b.id === t.id)?.nom || "Boutique").trim())}" style="position:absolute;left:${x}px;top:${y}px;width:${TAILLE}px;height:${TAILLE}px;border-radius:9999px;background:#ffffff;box-shadow:0 0 0 2px ${t.couleur}, 0 2px 5px rgba(0,0,0,.45);overflow:hidden;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:3;pointer-events:auto;">${t.contenu}</div>`;
          })
          .join("");
        const coeur = `<div style="position:absolute;left:${c0 - 7}px;top:${c0 - 7}px;width:14px;height:14px;border-radius:9999px;background:radial-gradient(circle,#450a0a 55%,#7f1d1d);border:2px dotted #F59E0B;box-sizing:border-box;box-shadow:0 1px 4px rgba(0,0,0,.5);z-index:2;pointer-events:none;"></div>`;
        const html = `<div style="position:relative;width:${cote}px;height:${cote}px;pointer-events:none;">${petales}${coeur}${visages}</div>`;
        // Position FIXE : le cœur est posé sur le centre du noyau du groupe (la boutique qui a le plus de voisines à 100 m ou moins, avec ces voisines). Quand d'autres boutiques
        // se joignent au groupe en dézoomant, ce noyau ne change pas : la fleur ne se déplace pas.
        const ll = membres.map((m) => m.entree.marqueur.getLatLng());
        const proches = (u, v) => carte.distance(u, v) <= 100;
        let noyau = ll;
        let meilleur = -1;
        ll.forEach((u) => {
          const voisines = ll.filter((v) => proches(u, v));
          if (voisines.length > meilleur) {
            meilleur = voisines.length;
            noyau = voisines;
          }
        });
        const lat = noyau.reduce((t, x) => t + x.lat, 0) / noyau.length;
        const lng = noyau.reduce((t, x) => t + x.lng, 0) / noyau.length;
        const icone = L.divIcon({ className: "tetes-groupees", html, iconSize: [cote, cote], iconAnchor: [cote / 2, cote / 2] });
        const mk = L.marker([lat, lng], { icon: icone, keyboard: false, zIndexOffset: 800 }).addTo(coucheTetes);
        // Les vraies épingles de ces boutiques sont masquées derrière le marqueur de groupe.
        tetes.forEach((t) => {
          t.el.style.display = "none";
          t.el.dataset.masqueTetes = "1";
        });
        const racine = mk.getElement?.();
        racine?.querySelectorAll("[data-tete]").forEach((h) => {
          h.addEventListener("click", (e) => {
            e.stopPropagation();
            marqueursCreesParId.get(h.getAttribute("data-tete"))?.marqueur?.fire("click", {});
          });
        });
      });
    }

    function recalculerDissociations(zoom = carte.getZoom()) {
      if (!Number.isFinite(zoom)) return;
      // Taille des avatars constante : ils ne grandissent plus au zoom ni au dézoom.
      const echelle = 1;

      // 1) Boutiques seules : lesquelles se recouvrent, et sont-elles séparables par le zoom ?
      const pixelsBoutiques = boutiquesAffichees.map((b) => {
        const px = carte.project([b.lat, b.lng], zoom);
        return { id: b.id, x: px.x, y: px.y, ici: false };
      });
      const { groupes } = calculerDecalagesDissociation(pixelsBoutiques, { echelle });
      const regroupes = new Set();
      const groupesBulle = [];
      groupeDeBoutique.clear();
      groupes.forEach((ids) => {
        // Au zoom maximal, on ne regroupe plus : l'anneau relié prend le relais.
        // Regroupement en bulle désactivé (demande du 18/10/2026) : les boutiques restent telles quelles.
        if (REGROUPER_EN_BULLES && zoom < ZOOM_ANNEAU && majorationSeparable(ids)) {
          groupesBulle.push(ids);
          ids.forEach((id) => {
            regroupes.add(id);
            groupeDeBoutique.set(id, ids);
          });
        }
      });

      // 2) Affichage : membres regroupés masqués, une bulle par groupe (recréées seulement si le découpage change).
      boutiquesAffichees.forEach((b) => {
        const el = marqueursCreesParId.get(b.id)?.marqueur?.getElement?.();
        if (el) el.style.display = regroupes.has(b.id) ? "none" : "";
      });
      const signature = groupesBulle.map((ids) => [...ids].sort().join("+")).sort().join("|");
      if (signature !== signatureBulles) {
        bullesActives.forEach((m) => groupe.removeLayer(m));
        bullesActives = [];
        groupesBulle.forEach((ids) => afficherBulle(ids));
        signatureBulles = signature;
      }
      // "Vous êtes ici" inclus dans le même regroupement que les boutiques
      // (pas seulement entre boutiques) : sinon, quand il coïncide avec une
      // boutique, son badge reste caché derrière elle sans jamais être
      // écarté — confirmé par capture d'écran réelle. Son pane est
      // maintenant AU-DESSUS des marqueurs (voir centrerSurPosition).
      // 01/11/2026 : « Vous êtes ici » n'entre PLUS dans ce calcul. Il est devenu un petit point (24 px) posé sous les épingles : il ne repousse plus les
      // boutiques voisines en anneau autour de lui et ne bouge jamais de sa position réelle.
      const points = boutiquesAffichees
        .filter((b) => !regroupes.has(b.id))
        .map((b) => ({ id: b.id, ll: [b.lat, b.lng], ici: false }));
      // Pixels ABSOLUS au zoom évalué (project) : ne dépend ni du centre ni
      // de l'animation en cours, donc utilisable dès zoomanim.
      // 01/11/2026 : la disposition (écartement en cercle) est calculée au zoom 16 au plus bas, puis gardée IDENTIQUE en pixels quand on dézoome :
      // mêmes places côte à côte, même taille, rien ne bouge ni ne se recouvre en dézoomant.
      const zoomCalcul = zoom; // 01/11/2026 : retour aux points fixes — la disposition gardée en dézoomant éloignait les épingles de leur vraie position
      const pixels = points.map((p) => {
        const px = carte.project(p.ll, zoomCalcul);
        return { id: p.id, x: px.x, y: px.y, ici: p.ici };
      });
      const { decalages, groupes: groupesRecouverts } = calculerDecalagesDissociation(pixels, { echelle });
      pixels.forEach((p) => {
        const entree = marqueursCreesParId.get(p.id);
        if (!entree) return;
        // Jamais d'écartement tant que la vue est éloignée (22/10/2026) : à ces zooms quelques pixels représentent des centaines
        // de mètres et posaient des pins en mer. La pointe d'un pin reste sur ses coordonnées ; l'écartement relié par un trait
        // n'intervient qu'à partir du zoom 16, pour atteindre des boutiques quasi superposées.
        // Boutiques proches : écartées les unes des autres (anneau relié par un trait à leur vraie position), jamais empilées. Un essai à false (01/11/2026) les empilait
        // les unes sur les autres : la demande portait sur « Vous êtes ici », qui n'entre plus dans ce calcul, pas sur l'écartement des boutiques.
        const d = SEPARER_BOUTIQUES_PROCHES && zoom >= ZOOM_ANNEAU ? decalages.get(p.id) : { dx: 0, dy: 0 };
        appliquerDecalageMarqueur(entree, d.dx, d.dy);
      });
      regroupes.forEach((id) => {
        const entree = marqueursCreesParId.get(id);
        if (entree) appliquerDecalageMarqueur(entree, 0, 0);
      });
      dessinerTetesGroupees(zoom);
    }

    aDesVoisinsRef.current = (id) => {
      // Positions AFFICHÉES (rectangles DOM des avatars, décalage d'éclatement
      // compris) et non les coordonnées géographiques : deux boutiques éclatées
      // en anneau sont proches à l'écran même si leurs latlng diffèrent.
      const rectAvatar = (entree) => {
        const el = entree?.marqueur?.getElement?.();
        if (!el || el.style.display === "none") return null; // absent ou caché dans une bulle
        const av = el.querySelector(".epingle-pin");
        const r = av?.getBoundingClientRect();
        return r && r.width > 0 ? r : null;
      };
      const moi = rectAvatar(marqueursCreesParId.get(id));
      if (!moi) return false;
      const cx = moi.left + moi.width / 2;
      for (const [autreId, entree] of marqueursCreesParId) {
        if (autreId === id) continue;
        const r = rectAvatar(entree);
        if (!r) continue;
        const dx = Math.abs(r.left + r.width / 2 - cx);
        // La bulle d'info (≈ 220 × 190 px) s'ouvre au-dessus de l'avatar.
        const dy = moi.top - (r.top + r.height / 2); // > 0 : le voisin est au-dessus
        if (dx < 160 && dy > -90 && dy < 260) return true;
      }
      return false;
    };

    // Permet au carrousel de faire apparaître une boutique cachée dans une bulle.
    zoomerSurBoutiqueRef.current = (id) => {
      const ids = groupeDeBoutique.get(id);
      if (!ids) return false;
      const membres = ids.map((i) => marqueursCreesParId.get(i)?.marqueur?.getLatLng()).filter(Boolean);
      carte.fitBounds(L.latLngBounds(membres), { padding: [70, 70], maxZoom: ZOOM_SEPARATION, animate: true, duration: 0.5 });
      return true;
    };

    // Sur écran tactile, un tap déclenche AUSSI des événements souris émulés
    // (mouseover/mouseenter) : la bulle « survol » s'ouvrait alors toute seule
    // au tap et recouvrait les boutiques voisines, qui devenaient intouchables
    // (mesuré : le tap tombait sur la bulle, pas sur l'avatar). Le survol ne
    // vaut donc que pour une vraie souris : on ignore les événements souris
    // survenus juste après un toucher.
    let dernierToucherLe = 0;
    const surToucher = () => {
      dernierToucherLe = Date.now();
    };
    if (carte.__surToucher) carte.getContainer().removeEventListener("touchstart", carte.__surToucher, true);
    carte.__surToucher = surToucher;
    carte.getContainer().addEventListener("touchstart", surToucher, { passive: true, capture: true });
    const toucherRecent = () => Date.now() - dernierToucherLe < 900;

    // Articles d'une boutique : ceux déjà rattachés à elle, sinon ceux de la liste générale (même boutique par identifiant ou par nom).
    const articlesDeLaBoutique = (b) => {
      if (b.articles && b.articles.length > 0) return b.articles;
      const bId = String(b.id || "");
      const bNom = (b.nom || "").trim().toLowerCase();
      return (tousArticles || []).filter((a) => {
        const aBId = String(a.boutique_id || a.boutiqueId || a.boutique?.id || "");
        const aBNom = (a.boutique_nom || a.boutiqueNom || a.boutique?.nom || "").trim().toLowerCase();
        return (bId && aBId && bId === aBId) || (bNom && aBNom && bNom === aBNom);
      });
    };

    boutiquesAffichees.forEach((b, idx) => {
      const avatarInfo = AVATARS_SNAP[idx % AVATARS_SNAP.length];
      const aPhoto = b.photo ? urlPhoto(b.photo) : null;
      const cheminPremierArticle = articlesDeLaBoutique(b).find((a) => a?.photos?.[0])?.photos?.[0];
      const photoPremierArticle = cheminPremierArticle ? urlPhoto(cheminPremierArticle) : null;
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
      const photoArticleCherche = photosArticlesRecherche.get(b.id);
      let bordureCouleur;
      let contenuAvatar;
      let badgeLive = "";
      let pointStatutTooltip = estActif ? "bg-[#10B981] animate-pulse" : "bg-gray-400";
      // Avatar façon Bitmoji en priorité, quel que soit le type_boutique :
      // seule la couleur de bordure reste liée au type. SVG DiceBear généré
      // en local et inliné directement — aucune URL externe.
      // Le LOGO (photo) de la boutique passe avant l'avatar Bitmoji.
      const avatarBitmoji = b.logo_url
        ? `<img src="${echapperHtml(b.logo_url)}" alt="" class="w-full h-full object-cover" />`
        : b.avatar_config
        ? svgAvatarBoutique(b.avatar_config, 52)
        : null;
      const avatarOuArticle = photoArticleCherche
        ? `<img src="${echapperHtml(photoArticleCherche)}" alt="" class="w-full h-full object-cover" />`
        : avatarBitmoji;
      if (typeBoutique === "service") {
        bordureCouleur = COULEUR_SERVICE;
        contenuAvatar = avatarOuArticle || `<span class="text-2xl">🔧</span>`;
      } else if (typeBoutique === "etablissement") {
        bordureCouleur = COULEUR_ETABLISSEMENT;
        contenuAvatar = avatarBitmoji || `<span class="text-2xl">${EMOJI_CATEGORIE_ETABLISSEMENT[b.categorie_etablissement] || "🏢"}</span>`;
      } else {
        bordureCouleur = estCertifie ? "#2563EB" : "#10B981";
        contenuAvatar =
          avatarOuArticle ||
          (aPhoto
            ? `<img src="${aPhoto}" alt="${nomCourt}" class="w-full h-full object-cover" />`
            : photoPremierArticle
            ? // Boutique sans logo, sans avatar ni photo : l'icône de son épingle est la première photo de ses articles.
              `<img src="${echapperHtml(photoPremierArticle)}" alt="${nomCourt}" class="w-full h-full object-cover" />`
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

      // Épingle façon Google Maps (voir src/lib/epingleCarte.js) : taille fixe (28 px, 36 px rouge sélectionnée), pointe sur la
      // coordonnée (ancre [70, 85]), nom à droite avec halo. Le décalage de dissociation reste appliqué au contenu en pixels.
      const htmlMarqueur = `
        <div class="marqueur-decale">
        ${htmlTraitRappel(70, 85)}
        <div class="marqueur-decale-contenu">
        ${htmlEpingle({ couleur: bordureCouleur, type: typeEpingle(b), nom: nomCourt, selectionne: estSelectionne, contenuHtml: contenuAvatar })}
        </div>
        </div>
      `;

      const icone = L.divIcon({
        html: htmlMarqueur,
        className: "snap-custom-icon",
        iconSize: [140, 90],
        iconAnchor: [70, 85],
      });

      const marqueur = L.marker([b.lat, b.lng], { icon: icone }).addTo(groupe);
      // decalageBas : vrai si ce marqueur a été poussé vers le BAS lors de
      // la dissociation automatique (voir recalculerDissociations) — sa
      // bulle doit alors s'ouvrir sur le côté plutôt que par-dessus l'autre
      // boutique juste au-dessus (voir ouvrirBulle plus bas).
      marqueursCreesParId.set(b.id, { marqueur, decalage: { dx: 0, dy: 0 }, decalageBas: false, ancre: [70, 85], rafraichirPopup: null });

      // Carrousel de produits au survol de la boutique (Inspiré de la capture utilisateur)
      const bId = String(b.id || "");
      const bNom = (b.nom || "").trim().toLowerCase();
      const articlesBoutique = (b.articles && b.articles.length > 0)
        ? b.articles
        : (tousArticles || []).filter((a) => {
            const aBId = String(a.boutique_id || a.boutiqueId || a.boutique?.id || "");
            const aBNom = (a.boutique_nom || a.boutiqueNom || a.boutique?.nom || "").trim().toLowerCase();
            return (bId && aBId && bId === aBId) || (bNom && aBNom && bNom === aBNom);
          });
      const articlesApercu = articlesBoutique.slice(0, 8);

      const htmlBulleProduits = `
        <div class="bulle-produits-container" style="position:relative; width:172px; max-width:172px; background:#ffffff; border-radius:18px; padding:10px 10px 8px 10px; font-family:inherit; color:#0f172a; box-shadow: 0 16px 36px rgba(0,0,0,0.35);">
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

          <!-- Carrousel des produits de la boutique -->
          ${
            articlesApercu.length > 0
              ? `
                <div class="bulle-defilement" style="width:140px; margin:0 auto; display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; padding:2px 1px 4px 1px; -webkit-overflow-scrolling:touch; touch-action:pan-x; overscroll-behavior-x:contain; cursor:grab; user-select:none;">
                  ${articlesApercu
                    .map((art) => {
                      const photoUrl = art.photos?.[0] ? urlPhoto(art.photos[0]) : (art.photo ? urlPhoto(art.photo) : (art.image ? urlPhoto(art.image) : ""));
                      const prixTxt = art.prix_xof || art.prix;
                      return `
                        <div style="flex-shrink:0; width:66px;">
                        <div data-article-id="${art.id}" style="flex-shrink:0; width:66px; height:86px; border-radius:14px; overflow:hidden; background:#c4a4b8; position:relative; box-shadow:0 3px 10px rgba(0,0,0,0.15); cursor:pointer; transition:transform 0.15s ease;">
                          ${
                            photoUrl
                              ? `<img src="${photoUrl}" alt="${echapperHtml(art.titre || "")}" style="width:100%; height:100%; object-fit:cover; display:block;" onerror="this.replaceWith(Object.assign(document.createElement('div'),{style:'width:100%;height:100%;background:#c4a4b8;display:flex;align-items:center;justify-content:center;font-size:22px;',textContent:'🛍️'}))" />`
                              : `<div style="width:100%; height:100%; background:linear-gradient(135deg,#c4a4b8,#a88b9e); display:flex; align-items:center; justify-content:center; font-size:22px;">🛍️</div>`
                          }
                          <div style="position:absolute; bottom:0; left:0; right:0; padding:6px 5px 4px 5px; background:linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.4) 70%, transparent 100%); color:#ffffff;">
                            <div style="font-size:8.5px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.1;">${echapperHtml(art.titre || "Article")}</div>
                            ${prixTxt ? `<div style="font-size:9.5px; font-weight:900; color:#34d399; margin-top:2px;">${Number(prixTxt).toLocaleString("fr-FR")} F</div>` : ""}
                          </div>
                        </div>
                        <button type="button" data-itineraire="${echapperHtml(String(b.id))}" style="margin-top:4px; width:66px; border:none; border-radius:10px; background:#10b981; color:#ffffff; padding:5px 0; font-size:10px; font-weight:800; cursor:pointer;">↱ Itinéraire</button>
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
        offset: [0, -88],
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
            // Épinglée : reste ouverte (voir fermerBulle plus haut, même
            // règle).
            if (boutiqueEpingleeIdRef.current === b.id) return;
            if (bullesFixesRef.current) return; // touche « Carrousel » : les bulles restent ouvertes
            timerSurvol = setTimeout(() => {
              carte.closePopup(popup);
            }, 300);
          });

          const btnFermer = el.querySelector(".btn-fermer-bulle");
          if (btnFermer) {
            btnFermer.onclick = (e) => {
              e.stopPropagation();
              setItineraireLocal(null);
              // Fermeture explicite : désépingle aussi, sinon un survol
              // suivant du même marqueur resterait bloqué "épinglé" sans
              // bulle visible.
              if (boutiqueEpingleeIdRef.current === b.id) boutiqueEpingleeIdRef.current = null;
              carte.closePopup(popup);
            };
          }

          el.querySelectorAll(".btn-ouvrir-boutique-header").forEach((btn) => {
            btn.onclick = (e) => {
              e.stopPropagation();
              if (boutiqueEpingleeIdRef.current === b.id) boutiqueEpingleeIdRef.current = null;
              carte.closePopup(popup);
              setBoutiqueSelectionnee(b);
              setVueBoutiqueDetails(true);
            };
          });

          // Défilement des articles à la souris (glisser, molette) ; au doigt, le défilement natif fait le travail
          // (touch-action: pan-x). Un glissement ne doit pas ouvrir l'article sur lequel il se termine.
          const bande = el.querySelector(".bulle-defilement");
          // Flèches gauche / droite : deux articles visibles à la fois ; une flèche n'apparaît que s'il reste des articles de ce côté.
          if (bande && !bande.__flechesPretes) {
            bande.__flechesPretes = true;
            const conteneur = bande.parentElement;
            const faireFleche = (cote) => {
              const bt = document.createElement("button");
              bt.type = "button";
              bt.setAttribute("data-fleche", cote);
              bt.setAttribute("aria-label", cote === "g" ? "Articles précédents" : "Articles suivants");
              bt.textContent = cote === "g" ? "‹" : "›";
              bt.style.cssText = `position:absolute;${cote === "g" ? "left:-4px" : "right:-4px"};top:${bande.offsetTop + bande.offsetHeight / 2 - 14}px;width:28px;height:28px;border-radius:9999px;border:none;background:#ffffff;color:#0f172a;font-size:20px;font-weight:900;line-height:26px;box-shadow:0 2px 8px rgba(0,0,0,.35);cursor:pointer;z-index:15;display:none;padding:0;`;
              bt.onclick = (e) => {
                e.stopPropagation();
                bande.scrollBy({ left: cote === "g" ? -148 : 148, behavior: "smooth" });
              };
              conteneur.appendChild(bt);
              return bt;
            };
            const fg = faireFleche("g");
            const fd = faireFleche("d");
            const majFleches = () => {
              fg.style.display = bande.scrollLeft > 2 ? "block" : "none";
              fd.style.display = bande.scrollLeft + bande.clientWidth < bande.scrollWidth - 2 ? "block" : "none";
            };
            bande.addEventListener("scroll", majFleches, { passive: true });
            setTimeout(majFleches, 30);
            setTimeout(majFleches, 400);
          }
          if (bande && !bande.__defilementPret) {
            bande.__defilementPret = true;
            let appuye = false;
            let departX = 0;
            let departScroll = 0;
            bande.__aGlisse = false;
            bande.addEventListener("pointerdown", (e) => {
              if (e.pointerType === "touch") return;
              appuye = true;
              bande.__aGlisse = false;
              departX = e.clientX;
              departScroll = bande.scrollLeft;
              bande.style.cursor = "grabbing";
            });
            window.addEventListener("pointermove", (e) => {
              if (!appuye) return;
              const dx = e.clientX - departX;
              if (Math.abs(dx) > 4) bande.__aGlisse = true;
              bande.scrollLeft = departScroll - dx;
            });
            window.addEventListener("pointerup", () => {
              if (!appuye) return;
              appuye = false;
              bande.style.cursor = "grab";
              setTimeout(() => {
                bande.__aGlisse = false;
              }, 0);
            });
            bande.addEventListener(
              "wheel",
              (e) => {
                const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
                if (delta) {
                  bande.scrollLeft += delta;
                  e.preventDefault();
                }
                e.stopPropagation();
              },
              { passive: false }
            );
          }

          el.querySelectorAll("[data-icone-boutique]").forEach((ic) => {
            ic.onclick = (e) => {
              e.stopPropagation();
              const cible = boutiquesAffichees.find((x) => String(x.id) === ic.getAttribute("data-icone-boutique"));
              if (cible) {
                setBoutiqueSelectionnee(cible);
                setVueBoutiqueDetails(true);
              }
            };
          });
          // Les icônes de profil sont sur UNE seule ligne, qui défile avec les produits : chaque icône se place au-dessus du premier article de sa boutique.
          const fenetreIcones = el.querySelector(".icones-fenetre");
          if (bande && fenetreIcones && !bande.__iconesPretes) {
            bande.__iconesPretes = true;
            const piste = fenetreIcones.querySelector(".icones-piste");
            // Chaque icône reste collée au bord gauche tant que les articles de SA boutique défilent, puis part avec le dernier d'entre eux (la suivante la remplace).
            const bornes = new Map();
            const placerIcones = () => {
              const z = bande.getBoundingClientRect();
              piste.style.width = Math.max(bande.scrollWidth, z.width) + "px";
              fenetreIcones.querySelectorAll("[data-icone-boutique]").forEach((ic) => {
                const id = ic.getAttribute("data-icone-boutique");
                const cartes1 = [...bande.querySelectorAll(`[data-boutique-de="${id}"]`)];
                if (!cartes1.length) {
                  ic.style.display = "none";
                  return;
                }
                const debut = cartes1[0].getBoundingClientRect().left - z.left + bande.scrollLeft;
                const fin = cartes1[cartes1.length - 1].getBoundingClientRect().right - z.left + bande.scrollLeft;
                bornes.set(id, { debut, fin });
              });
              majPosIcones();
            };
            const majPosIcones = () => {
              fenetreIcones.scrollLeft = bande.scrollLeft;
              const largeur = 26;
              fenetreIcones.querySelectorAll("[data-icone-boutique]").forEach((ic) => {
                const bn = bornes.get(ic.getAttribute("data-icone-boutique"));
                if (!bn) return;
                const x = Math.min(Math.max(bande.scrollLeft + 1, bn.debut), bn.fin - largeur);
                ic.style.left = Math.round(x) + "px";
              });
            };
            bande.addEventListener("scroll", majPosIcones, { passive: true });
            setTimeout(placerIcones, 30);
            setTimeout(placerIcones, 400);
          }
          if (bande && !bande.__anneauPret && el.querySelector("[data-icone-boutique]")) {
            bande.__anneauPret = true;
            const majAnneau = () => {
              const z = bande.getBoundingClientRect();
              const premier = [...bande.querySelectorAll("[data-boutique-de]")].find((c) => c.getBoundingClientRect().right > z.left + 8);
              const id = premier?.getAttribute("data-boutique-de");
              el.querySelectorAll("[data-icone-boutique]").forEach((ic) => {
                ic.style.borderColor = ic.getAttribute("data-icone-boutique") === id ? "#10b981" : "#e2e8f0";
              });
            };
            bande.addEventListener("scroll", majAnneau, { passive: true });
            setTimeout(majAnneau, 40);
          }
          el.querySelectorAll("[data-itineraire]").forEach((btn) => {
            btn.onclick = (e) => {
              e.stopPropagation();
              const cible = boutiquesAffichees.find((x) => String(x.id) === btn.getAttribute("data-itineraire"));
              if (cible) {
                setItineraireLocal({ id: cible.id, nom: cible.nom, lat: Number(cible.lat), lng: Number(cible.lng) });
              }
            };
          });

          el.querySelectorAll("[data-article-id]").forEach((card) => {
            card.onclick = (e) => {
              e.stopPropagation();
              if (bande?.__aGlisse) return; // fin d'un glissement, pas un vrai tap
              if (boutiqueEpingleeIdRef.current === b.id) boutiqueEpingleeIdRef.current = null;
              carte.closePopup(popup);
              const artId = card.getAttribute("data-article-id");
              if (typeof onVoirArticle === "function") {
                // La fiche attend l'article COMPLET (pas son seul identifiant, qui donnait une fiche vide « 0 FCFA ») : retrouvé parmi tous les articles et ceux des boutiques affichées.
                const objet =
                  (tousArticles || []).find((a) => String(a.id) === String(artId)) ||
                  boutiquesAffichees.flatMap((x) => articlesDeLaBoutique(x)).find((a) => String(a?.id) === String(artId));
                onVoirArticle(objet || artId);
              } else {
                setBoutiqueSelectionnee(b);
                setVueBoutiqueDetails(true);
              }
            };
          });
        }, 10);
      };

      // Le marqueur reste à sa vraie coordonnée (seul son CONTENU est décalé
      // en pixels, voir recalculerDissociations) : la bulle doit donc être
      // décalée du même vecteur pour rester collée à l'avatar affiché.
      // Poussée vers le bas par la dissociation : ouverte sur le côté plutôt
      // que par-dessus l'autre boutique juste au-dessus, sinon elle la
      // recouvre entièrement. Signalé par l'utilisateur avec une capture
      // réelle des deux avatars empilés.
      // La fenêtre est TOUJOURS centrée juste au-dessus de la pastille « ● Nom · Quartier » de la boutique,
      // sa pointe posée à 8 px au-dessus d'elle. Le décalage est MESURÉ sur la pastille réellement affichée
      // (l'avatar grandit avec le zoom et à la sélection) : avec un décalage fixe, la pastille passait
      // par-dessus la fenêtre. Elle ne se déplace jamais pour esquiver la barre du haut : c'est la CARTE
      // qui bouge au besoin (voir ajusterBulle).
      const offsetPopup = () => {
        const entree = marqueursCreesParId.get(b.id);
        const d = entree?.decalage || { dx: 0, dy: 0 };
        const pastille = marqueur.getElement()?.querySelector(".epingle-pin");
        if (pastille && pastille.getBoundingClientRect().width > 0) {
          const c = carte.getContainer().getBoundingClientRect();
          const r = pastille.getBoundingClientRect();
          const pt = carte.latLngToContainerPoint(marqueur.getLatLng());
          return [d.dx, Math.round(r.top - c.top - pt.y - 8)];
        }
        // Épingle masquée derrière une fleur : la bulle se pose juste au-dessus de la fleur (rayon d'environ 46 px).
        if (marqueur.getElement()?.dataset?.masqueTetes === "1") return [d.dx, -60];
        return [d.dx, -88 + d.dy];
      };

      // Repositionne la fenêtre sans toucher à son contenu : popup.update() de Leaflet RÉÉCRIT le contenu (innerHTML)
      // et efface alors les gestionnaires (croix, articles, glissement du carrousel).
      const repositionnerBulle = () => {
        if (typeof popup._updatePosition === "function") popup._updatePosition();
        else popup.update();
      };

      // Fait entrer TOUTE la fenêtre dans la zone visible (sous l'en-tête, dans la largeur de l'écran) en
      // déplaçant la carte, jamais la fenêtre : elle reste collée à sa boutique et ne touche pas la barre du haut.
      const ajusterBulle = () => {
        const el = popup.getElement();
        const boite = el?.querySelector(".leaflet-popup-content-wrapper");
        if (!boite || !popup.isOpen() || carteRef.current !== carte) return;
        const MARGE = 8;
        const MARGE_DROITE = 66;
        const c = carte.getContainer().getBoundingClientRect();
        const r = boite.getBoundingClientRect();
        const limiteHaut = headerRef.current ? headerRef.current.getBoundingClientRect().bottom - c.top + MARGE : MARGE;
        let dx = 0;
        let dy = 0;
        if (r.top - c.top < limiteHaut) dy = r.top - c.top - limiteHaut; // négatif : le contenu descend
        if (r.left - c.left < MARGE) dx = r.left - c.left - MARGE;
        // À droite, on laisse la place de la colonne de boutons ronds (position, thème, zoom) : sinon la croix
        // de la fenêtre passait dessous.
        else if (r.right - c.left > c.width - MARGE_DROITE) dx = r.right - c.left - (c.width - MARGE_DROITE);
        if (dx || dy) carte.panBy([dx, dy], { animate: true, duration: 0.35 });
      };

      const ouvrirBulle = () => {
        if (bullesFixesRef.current) return; // touche « Carrousel » : toutes les bulles (ou la bulle regroupée) sont déjà ouvertes, pas de seconde bulle au survol
        if (timerSurvol) clearTimeout(timerSurvol);
        popup.options.offset = offsetPopup();
        popup.setLatLng(marqueur.getLatLng()).openOn(carte);
        attacherEcouteursPopup();
        // Repositionnée une fois affichée (taille réelle connue) puis après tout déplacement de la carte.
        setTimeout(() => {
          if (!popup.isOpen()) return;
          popup.options.offset = offsetPopup();
          repositionnerBulle();
          ajusterBulle();
        }, 40);
        carte.once("moveend", () => setTimeout(ajusterBulle, 30));
      };
      // Le zoom change le décalage : une bulle déjà ouverte le suit.
      marqueursCreesParId.get(b.id).rafraichirPopup = () => {
        if (popup.isOpen()) {
          popup.options.offset = offsetPopup();
          repositionnerBulle();
        }
      };

      const fermerBulle = () => {
        // Épinglée (simple clic confirmé, voir plus bas) : reste ouverte
        // tant qu'on ne la désépingle pas explicitement (nouveau clic ou
        // double-clic sur une autre boutique).
        if (boutiqueEpingleeIdRef.current === b.id) return;
        if (bullesFixesRef.current) return; // touche « Carrousel » : les bulles restent ouvertes
        timerSurvol = setTimeout(() => {
          carte.closePopup(popup);
        }, 300);
      };

      // Touche « Carrousel » : ouvre cette bulle SANS fermer les autres (autoClose désactivé) et sans déplacer la carte (pas d'ajustement : avec plusieurs bulles, les
      // déplacements se contrarieraient).
      const ouvrirFixe = (htmlGroupe) => {
        if (timerSurvol) clearTimeout(timerSurvol);
        if (carteRef.current !== carte) return;
        // Boutiques proches regroupées : la bulle de la première porte le carrousel de toutes (htmlGroupe), sinon son contenu d'origine.
        popup.setContent(htmlGroupe || htmlBulleProduits);
        popup.options.autoClose = false;
        popup.options.offset = offsetPopup();
        popup.setLatLng(marqueur.getLatLng());
        if (!carte.hasLayer(popup)) popup.addTo(carte);
        attacherEcouteursPopup();
        setTimeout(() => {
          if (!popup.isOpen()) return;
          popup.options.offset = offsetPopup();
          repositionnerBulle();
        }, 40);
      };
      const fermerFixe = () => {
        popup.options.autoClose = true;
        if (carte.hasLayer(popup)) carte.removeLayer(popup);
        popup.setContent(htmlBulleProduits);
      };
      // Mesure de la bulle affichée et déplacement en pixels par rapport à sa place normale (au-dessus de sa boutique).
      const mesurerBulle = () => popup.getElement()?.querySelector(".leaflet-popup-content-wrapper")?.getBoundingClientRect() || null;
      const mesurerBulleElement = () => popup.getElement()?.querySelector(".leaflet-popup-content-wrapper") || null;
      const deplacerBulle = (dx, dy) => {
        if (!carte.hasLayer(popup) || !popup._map) return; // bulle fermée entre-temps (bascule Carrousel/Arbre) : rien à déplacer
        const base = offsetPopup();
        popup.options.offset = [base[0] + dx, base[1] + dy];
        repositionnerBulle();
      };

      // La bulle s'ouvre : si la boutique est fixée, les autres se masquent. Elle se ferme (croix, nouveau
      // tap, fond de carte, autre boutique) : la boutique n'est plus fixée et tout revient.
      popup.on("add", appliquerFocusBoutique);
      popup.on("remove", () => {
        if (boutiqueEpingleeIdRef.current === b.id) boutiqueEpingleeIdRef.current = null;
        appliquerFocusBoutique();
      });

      popupsBoutiquesRef.current.set(b.id, {
        ouvrir: ouvrirBulle,
        fermer: fermerBulle,
        ouvrirFixe,
        fermerFixe,
        mesurerBulle,
        mesurerBulleElement,
        deplacerBulle,
        boutique: b,
      });

      const ouvrirAuSurvol = () => {
        if (!toucherRecent()) ouvrirBulle();
      };
      const fermerALaSortie = () => {
        if (!toucherRecent()) fermerBulle();
      };
      marqueur.on("mouseover", ouvrirAuSurvol);
      marqueur.on("mouseout", fermerALaSortie);

      // Écouteur direct sur l'élément DOM du marqueur une fois ajouté
      setTimeout(() => {
        const elIcon = marqueur.getElement();
        if (elIcon) {
          elIcon.addEventListener("mouseenter", ouvrirAuSurvol);
          elIcon.addEventListener("mouseleave", fermerALaSortie);
        }
      }, 50);

      // Survol -> bulle temporaire (déjà géré ci-dessus). Simple clic ->
      // épingle/désépingle la bulle (reste ouverte, articles navigables,
      // sans quitter la carte). Double-clic -> entre dans la fiche complète
      // de la boutique. Un simple setTimeout distingue les deux : le
      // premier clic attend le délai avant d'agir ; un second clic pendant
      // ce délai annule l'action "simple clic" et déclenche le double-clic
      // à la place. Nouvelle interaction demandée explicitement par
      // l'utilisateur, inspirée des cartes façon Snapchat.
      // Premier clic : réaction IMMÉDIATE (bulle + sélection). Un second clic
      // dans les 320 ms ouvre la fiche complète. Avant, le premier clic
      // attendait 260 ms pour distinguer simple et double clic : la carte
      // « mettait du temps à répondre » (retour utilisateur du 12/10/2026).
      let dernierClicLe = 0;
      marqueur.on("click", (e) => {
        if (e?.originalEvent) e.originalEvent.stopPropagation();
        const maintenant = Date.now();

        if (maintenant - dernierClicLe < 320) {
          dernierClicLe = 0;
          boutiqueEpingleeIdRef.current = null;
          ouvrirBulle();
          setBoutiqueSelectionnee(b);
          setVueBoutiqueDetails(true);
          carte.panTo(marqueur.getLatLng(), { animate: true, duration: 0.4 });
          return;
        }
        dernierClicLe = maintenant;

        if (boutiqueEpingleeIdRef.current === b.id) {
          boutiqueEpingleeIdRef.current = null;
          carte.closePopup(popup);
          return;
        }
        // Une seule boutique épinglée à la fois : ferme la précédente avant
        // d'épingler celle-ci.
        carte.closePopup();
        // Boutiques proches : un tap fixe directement la boutique et ouvre le carrousel de ses
        // articles ; les autres boutiques DISPARAISSENT tant qu'il est ouvert (voir
        // appliquerFocusBoutique), elles reviennent à sa fermeture. Avant, le 1er tap ne faisait que
        // sélectionner quand des voisines étaient proches, et la bulle recouvrait les autres.
        boutiqueEpingleeIdRef.current = b.id;
        ouvrirBulle();
        setBoutiqueSelectionnee(b);
        setFicheCarteOuverte(true);
        // Pas de recentrage ici : ajusterBulle déplace la carte juste ce qu'il faut pour que toute la
        // fenêtre soit visible, sans éloigner la boutique de l'endroit touché.
      });
    });

    // Touche « Carrousel » : ouvre (ou ferme) la bulle de toutes les boutiques affichées. Recréée à chaque reconstruction des marqueurs ; si la touche est
    // active, les bulles sont rouvertes tout de suite sur les nouveaux marqueurs.
    // Les bulles ouvertes ensemble ne doivent pas se recouvrir : chacune garde sa boutique pour pointe, mais est décalée (côté, puis plus haut) jusqu'à trouver une
    // place libre dans la carte, sous la barre du haut. Recalculé à chaque changement de zoom.
    // Chaque bulle ouverte par « Carrousel » reçoit une couleur : un trait part de sa pointe et finit sur un POINT de la même couleur posé sur la vraie position de sa boutique
    // (les épingles pouvant être empilées au dézoom). Le haut de la bulle porte la même couleur. Effacé dès que la carte bouge, redessiné quand elle est immobile.
    const COULEURS_LIENS = ["#EF4444", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];
    const effacerLiens = () => {
      carte.getContainer().querySelectorAll("[data-liens-bulles]").forEach((e) => e.remove());
      popupsBoutiquesRef.current.forEach((h) => {
        const w = h.mesurerBulleElement?.();
        if (w) w.style.borderTop = "";
      });
    };
    const dessinerLiens = () => {
      if (!bullesFixesRef.current || carteRef.current !== carte) return;
      effacerLiens();
      const cont = carte.getContainer();
      const c = cont.getBoundingClientRect();
      const NS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(NS, "svg");
      svg.setAttribute("data-liens-bulles", "1");
      svg.setAttribute("width", c.width);
      svg.setAttribute("height", c.height);
      svg.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;z-index:690;overflow:visible;";
      boutiquesAffichees.forEach((b, k) => {
        const h = popupsBoutiquesRef.current.get(b.id);
        const w = h?.mesurerBulleElement?.();
        if (!w) return;
        const couleur = COULEURS_LIENS[k % COULEURS_LIENS.length];
        const r = w.getBoundingClientRect();
        const pt = carte.latLngToContainerPoint([b.lat, b.lng]);
        const x1 = r.left + r.width / 2 - c.left;
        const y1 = r.bottom - c.top;
        const ligne = document.createElementNS(NS, "line");
        ligne.setAttribute("x1", x1);
        ligne.setAttribute("y1", y1);
        ligne.setAttribute("x2", pt.x);
        ligne.setAttribute("y2", pt.y);
        ligne.setAttribute("stroke", couleur);
        ligne.setAttribute("stroke-width", "2.5");
        ligne.setAttribute("stroke-linecap", "round");
        svg.appendChild(ligne);
        const point = document.createElementNS(NS, "circle");
        point.setAttribute("cx", pt.x);
        point.setAttribute("cy", pt.y);
        point.setAttribute("r", "6");
        point.setAttribute("fill", couleur);
        point.setAttribute("stroke", "#fff");
        point.setAttribute("stroke-width", "2");
        svg.appendChild(point);
        w.style.borderTop = "5px solid " + couleur;
      });
      cont.appendChild(svg);
    };
    // Boutiques proches (épingles empilées au dézoom) : UNE seule bulle, avec les articles de toutes et leur nombre en haut. Au zoom d'écartement (16+) chaque boutique a la sienne.
    // Bulle regroupée : pour chaque boutique associée dont l'épingle est loin de la pointe de la bulle, un petit « pic » sur le bord de la bulle, tourné vers cette épingle,
    // montre que sa boutique est associée (ex. Véronique Mendy).
    const ajouterPicsAssocies = () => {
      if (!bullesFixesRef.current || carteRef.current !== carte) return;
      carte.getContainer().querySelectorAll("[data-pic-associe]").forEach((e) => e.remove());
      const centreEpingle = (id) => {
        const el = marqueursCreesParId.get(id)?.marqueur?.getElement?.();
        if (!el || el.style.display === "none") return null;
        const r = el.querySelector(".epingle-pin")?.getBoundingClientRect();
        return r && r.width > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
      };
      (carte.__groupesBulles || new Map()).forEach((ids, chef) => {
        const popupEl = popupsBoutiquesRef.current.get(chef)?.mesurerBulleElement?.()?.closest(".leaflet-popup");
        const bulle = popupsBoutiquesRef.current.get(chef)?.mesurerBulle?.();
        const pointeChef = centreEpingle(chef);
        if (!popupEl || !bulle || !pointeChef) return;
        const po = popupEl.getBoundingClientRect();
        const cx = bulle.left + bulle.width / 2;
        const cy = bulle.top + bulle.height / 2;
        ids.filter((id) => id !== chef).forEach((id) => {
          const cible = centreEpingle(id);
          if (!cible || Math.hypot(cible.x - pointeChef.x, cible.y - pointeChef.y) < 70) return; // épingle voisine de celle de la pointe : rien à montrer
          const dx = cible.x - cx;
          const dy = cible.y - cy;
          if (!dx && !dy) return;
          const t = Math.min(dx ? bulle.width / 2 / Math.abs(dx) : Infinity, dy ? bulle.height / 2 / Math.abs(dy) : Infinity);
          const bx = cx + dx * t;
          const by = cy + dy * t;
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          const pic = document.createElement("div");
          pic.setAttribute("data-pic-associe", id);
          pic.title = (boutiquesAffichees.find((b) => b.id === id)?.nom || "Boutique") + " (associée)";
          pic.style.cssText = `position:absolute;left:${bx - po.left}px;top:${by - po.top}px;width:0;height:0;transform:rotate(${angle}deg);transform-origin:0 0;pointer-events:none;z-index:5;filter:drop-shadow(0 1px 2px rgba(0,0,0,.25));`;
          pic.innerHTML = '<div style="position:absolute;left:-2px;top:-11px;width:0;height:0;border-top:11px solid transparent;border-bottom:11px solid transparent;border-left:20px solid #ffffff;"></div>';
          popupEl.appendChild(pic);
        });
      });
    };

    // Disposition « arbre » (essai du 02/11/2026, croquis de l'utilisateur) : au lieu de fusionner les boutiques proches en une seule bulle, chacune garde SA bulle ; les bulles
    // se rangent côte à côte au-dessus du groupe et sont reliées à leur épingle par des traits qui se rejoignent en un tronc (bulle → barre → tronc → branche → épingle).
    // L'arbre (touche « Arbre », visible quand le Carrousel est ouvert) est lu dans arbreActifRef ; par défaut éteint : la bulle regroupée reste la version normale.
    const effacerArbres = () => carte.getContainer().querySelectorAll("[data-arbres-bulles]").forEach((e) => e.remove());
    const dessinerArbres = () => {
      effacerArbres();
      if (!arbreActifRef.current || !bullesFixesRef.current || carteRef.current !== carte) return;
      const groupes = carte.__arbres || [];
      if (!groupes.length) return;
      const cont = carte.getContainer();
      const c = cont.getBoundingClientRect();
      const NS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(NS, "svg");
      svg.setAttribute("data-arbres-bulles", "1");
      svg.setAttribute("width", c.width);
      svg.setAttribute("height", c.height);
      svg.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;z-index:590;overflow:visible;filter:drop-shadow(0 4px 3px rgba(15,23,42,.38));";
      const defs = document.createElementNS(NS, "defs");
      defs.innerHTML = '<radialGradient id="sphere-arbre" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#ffffff"/><stop offset="55%" stop-color="#cbd5e1"/><stop offset="100%" stop-color="#64748b"/></radialGradient>';
      svg.appendChild(defs);
      const sphere = (x, y, r) => {
        const o = document.createElementNS(NS, "circle");
        o.setAttribute("cx", x);
        o.setAttribute("cy", y);
        o.setAttribute("r", r);
        o.setAttribute("fill", "url(#sphere-arbre)");
        o.setAttribute("stroke", "#334155");
        o.setAttribute("stroke-width", "0.8");
        svg.appendChild(o);
      };
      // Traits en « tubes » : bord sombre, corps gris clair, reflet blanc au centre.
      const trait = (d) => {
        [["#0f172a", 7, 0.5], ["#cbd5e1", 4.6, 1], ["#ffffff", 1.6, 1]].forEach(([couleur, largeur, opacite]) => {
          const chemin = document.createElementNS(NS, "path");
          chemin.setAttribute("d", d);
          chemin.setAttribute("fill", "none");
          chemin.setAttribute("stroke", couleur);
          chemin.setAttribute("stroke-width", largeur);
          chemin.setAttribute("stroke-opacity", opacite);
          chemin.setAttribute("stroke-linecap", "round");
          chemin.setAttribute("stroke-linejoin", "round");
          svg.appendChild(chemin);
        });
      };
      groupes.forEach((ids) => {
        const items = ids
          .map((id) => {
            const bulle = popupsBoutiquesRef.current.get(id)?.mesurerBulle?.();
            const pin = marqueursCreesParId.get(id)?.marqueur?.getElement?.()?.querySelector(".epingle-pin")?.getBoundingClientRect();
            return bulle && pin && pin.width > 0 ? { bulle, pin } : null;
          })
          .filter(Boolean);
        if (items.length < 2) return;
        const px = (i) => i.pin.left + i.pin.width / 2 - c.left;
        const pyHaut = (i) => i.pin.top - c.top + 6;
        const troncX = items.reduce((t, i) => t + px(i), 0) / items.length;
        const yFourche = Math.min(...items.map(pyHaut)) - 18;
        // Chaque bulle se relie par son côté intérieur, à mi-hauteur, au tronc vertical.
        const jonctions = items.map((i) => {
          const gauche = i.bulle.left + i.bulle.width / 2 - c.left < troncX;
          const ex = (gauche ? i.bulle.right : i.bulle.left) - c.left;
          const ey = i.bulle.top + i.bulle.height / 2 - c.top;
          return { ex, ey };
        });
        jonctions.forEach((jn) => trait(`M ${jn.ex} ${jn.ey} L ${troncX} ${jn.ey}`));
        const yHautTronc = Math.min(...jonctions.map((jn) => jn.ey));
        trait(`M ${troncX} ${yHautTronc} L ${troncX} ${yFourche}`);
        items.forEach((i) => trait(`M ${troncX} ${yFourche} L ${px(i)} ${yFourche + 8} L ${px(i)} ${pyHaut(i)}`));
        jonctions.forEach((jn) => {
          sphere(jn.ex, jn.ey, 4.5);
          sphere(troncX, jn.ey, 4.2);
        });
        items.forEach((i) => sphere(px(i), pyHaut(i), 4.5));
        sphere(troncX, yFourche, 5.5);
      });
      cont.appendChild(svg);
    };
    let imageArbre = 0;
    const planifierArbres = () => {
      if (imageArbre) return;
      imageArbre = requestAnimationFrame(() => {
        imageArbre = 0;
        dessinerArbres();
      });
    };
    // Range les bulles d'un groupe côte à côte au-dessus de ses épingles (leurs pointes sont cachées : les traits prennent le relais).
    const placerArbres = () => {
      if (!arbreActifRef.current || !bullesFixesRef.current || carteRef.current !== carte) return;
      const groupes = carte.__arbres || [];
      groupes.forEach((ids) => {
        const infos = ids
          .map((id) => {
            const h = popupsBoutiquesRef.current.get(id);
            const pin = marqueursCreesParId.get(id)?.marqueur?.getElement?.()?.querySelector(".epingle-pin")?.getBoundingClientRect();
            h?.deplacerBulle?.(0, 0);
            const bulle = h?.mesurerBulle?.();
            return h && pin && pin.width > 0 && bulle ? { id, h, pin, bulle } : null;
          })
          .filter(Boolean);
        if (infos.length < 2) return;
        const ordre = infos.slice().sort((u, v) => u.pin.left - v.pin.left);
        const centreGroupe = ordre.reduce((t, i) => t + i.pin.left + i.pin.width / 2, 0) / ordre.length;
        const hautPinMin = Math.min(...ordre.map((i) => i.pin.top));
        const HAUTEUR_TRAITS = 58; // entre le bas de la bulle la plus basse et la plus haute épingle
        const DEGAGEMENT_TRONC = 26; // espace entre le tronc et chaque colonne
        const ECART_VERTICAL = 8;
        // Deux colonnes de part et d'autre du tronc (moitié gauche des épingles à gauche, moitié droite à droite), bulles empilées du bas vers le haut.
        const moitie = Math.ceil(ordre.length / 2);
        [[ordre.slice(0, moitie), -1], [ordre.slice(moitie), 1]].forEach(([colonne, signe]) => {
          let bas = hautPinMin - HAUTEUR_TRAITS;
          colonne.forEach((i) => {
            const cibleCentreX = centreGroupe + signe * (DEGAGEMENT_TRONC + i.bulle.width / 2);
            const dx = cibleCentreX - (i.bulle.left + i.bulle.width / 2);
            const dy = bas - i.bulle.bottom;
            i.h.deplacerBulle?.(dx, dy);
            bas -= i.bulle.height + ECART_VERTICAL;
            // Relief : la bulle pivote légèrement vers le tronc, avec une tranche épaisse et une grande ombre portée.
            const w = i.h.mesurerBulleElement?.();
            if (w) {
              w.style.transformOrigin = signe < 0 ? "100% 50%" : "0% 50%";
              w.style.transform = `perspective(900px) rotateY(${signe < 0 ? 9 : -9}deg)`;
              w.style.boxShadow = "0 1px 0 #ffffff inset, 0 3px 0 #d3dbe6, 0 6px 0 #b4c0d0, 0 9px 0 #94a3b8, 0 22px 30px rgba(15,23,42,.5)";
            }
          });
        });
      });
      ordreMasquerPointes();
      setTimeout(dessinerArbres, 80);
    };
    const ordreMasquerPointes = () => {
      const groupes = carte.__arbres || [];
      carte.getContainer().querySelectorAll(".leaflet-popup-tip-container").forEach((t) => (t.style.display = ""));
      groupes.flat().forEach((id) => {
        const el = popupsBoutiquesRef.current.get(id)?.mesurerBulleElement?.()?.closest(".leaflet-popup");
        const tip = el?.querySelector(".leaflet-popup-tip-container");
        if (tip) tip.style.display = "none";
      });
    };
    if (!carte.__arbreAttache) {
      carte.__arbreAttache = true;
      carte.on("move zoom viewreset", planifierArbres);
      carte.on("zoomend", () => {
        if (arbreActifRef.current && bullesFixesRef.current) setTimeout(placerArbres, 350);
      });
    }

    const construireHtmlGroupe = (membres) => {
      const articles = [];
      const vus = new Set();
      membres.forEach((m) =>
        articlesDeLaBoutique(m).forEach((a) => {
          if (a?.id != null && !vus.has(String(a.id))) {
            vus.add(String(a.id));
            articles.push({ a, boutiqueId: m.id, membre: m });
          }
        })
      );
      // En-tête : une pastille de profil CLIQUABLE par boutique du groupe (logo, sinon avatar Bitmoji, sinon emoji). Celle dont les articles passent est entourée.
      const pastilles = membres
        .map((m, k) => {
          let icone = "🏪";
          try {
            icone = m.logo_url ? `<img src="${echapperHtml(m.logo_url)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" />` : m.avatar_config ? svgAvatarBoutique(m.avatar_config, 26) : icone;
          } catch {}
          return `<button type="button" data-icone-boutique="${echapperHtml(String(m.id))}" title="${echapperHtml((m.nom || "Boutique").trim())}" aria-label="${echapperHtml((m.nom || "Boutique").trim())}" style="width:26px;height:26px;border-radius:9999px;overflow:hidden;background:#ffffff;border:2px solid ${k === 0 ? "#10b981" : "#e2e8f0"};padding:0;display:flex;align-items:center;justify-content:center;font-size:15px;line-height:1;cursor:pointer;position:absolute;top:1px;left:0;">${icone}</button>`;
        })
        .join("");
      const cartes = articles
        .map(({ a: art, boutiqueId }) => {
          const photoUrl = art.photos?.[0] ? urlPhoto(art.photos[0]) : art.photo ? urlPhoto(art.photo) : art.image ? urlPhoto(art.image) : "";
          const prixTxt = art.prix_xof || art.prix;
          return `<div data-boutique-de="${echapperHtml(String(boutiqueId))}" style="flex-shrink:0; width:66px;"><div data-article-id="${art.id}" style="flex-shrink:0; width:66px; height:86px; border-radius:14px; overflow:hidden; background:#c4a4b8; position:relative; box-shadow:0 3px 10px rgba(0,0,0,0.15); cursor:pointer;">${
            photoUrl
              ? `<img src="${photoUrl}" alt="${echapperHtml(art.titre || "")}" style="width:100%; height:100%; object-fit:cover; display:block;" />`
              : `<div style="width:100%; height:100%; background:linear-gradient(135deg,#c4a4b8,#a88b9e); display:flex; align-items:center; justify-content:center; font-size:22px;">🛍️</div>`
          }<div style="position:absolute; bottom:0; left:0; right:0; padding:6px 5px 4px 5px; background:linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.4) 70%, transparent 100%); color:#ffffff;"><div style="font-size:8.5px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.1;">${echapperHtml(art.titre || "Article")}</div>${prixTxt ? `<div style="font-size:9.5px; font-weight:900; color:#34d399; margin-top:2px;">${Number(prixTxt).toLocaleString("fr-FR")} F</div>` : ""}</div></div><button type="button" data-itineraire="${echapperHtml(String(boutiqueId))}" style="margin-top:4px; width:66px; border:none; border-radius:10px; background:#10b981; color:#ffffff; padding:5px 0; font-size:10px; font-weight:800; cursor:pointer;">↱ Itinéraire</button></div>`;
        })
        .join("");
      return `<div class="bulle-produits-container" style="position:relative; width:172px; max-width:172px; background:#ffffff; border-radius:18px; padding:10px 10px 8px 10px; font-family:inherit; color:#0f172a; box-shadow: 0 16px 36px rgba(0,0,0,0.35);">
        <button type="button" class="btn-fermer-bulle" style="position:absolute; top:7px; right:8px; width:20px; height:20px; border-radius:9999px; background:#f1f5f9; border:none; display:flex; align-items:center; justify-content:center; color:#64748b; font-size:11px; font-weight:900; cursor:pointer; z-index:20; line-height:1;" title="Fermer">✕</button>
        <div style="margin-bottom:8px; padding-right:22px;">
          <div class="icones-fenetre" style="width:140px; max-width:100%; overflow:hidden; height:30px; position:relative;"><div class="icones-piste" style="position:relative; height:30px; width:140px;">${pastilles}</div></div>
          <div style="font-size:9px; font-weight:700; color:#64748b; margin-top:3px; white-space:nowrap;">${membres.length} boutiques · <span style="color:#059669;">${articles.length} article${articles.length > 1 ? "s" : ""}</span></div>
        </div>
        <div class="bulle-defilement" style="width:140px; margin:0 auto; display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; padding:2px 1px 4px 1px; -webkit-overflow-scrolling:touch; touch-action:pan-x; overscroll-behavior-x:contain; cursor:grab; user-select:none;">${cartes}</div>
      </div>`;
    };
    // (Ré)ouvre les bulles : groupées pour les boutiques qui se touchent au dézoom, individuelles sinon.
    const appliquerBullesFixes = () => {
      if (!bullesFixesRef.current || carteRef.current !== carte) return;
      const zoom = carte.getZoom();
      // Groupes : boutiques à 100 m ou moins les unes des autres (distance réelle, à tout zoom), plus celles dont les épingles se recouvrent au dézoom.
      const RAYON_GROUPE_M = 100;
      const metres = (u, v) => {
        const R = 6371000;
        const rad = Math.PI / 180;
        const dLat = (v.lat - u.lat) * rad;
        const dLng = (v.lng - u.lng) * rad;
        const h = Math.sin(dLat / 2) ** 2 + Math.cos(u.lat * rad) * Math.cos(v.lat * rad) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(h));
      };
      const pixels = boutiquesAffichees.map((b) => {
        const px = carte.project([b.lat, b.lng], zoom);
        return { x: px.x, y: px.y };
      });
      const parent = boutiquesAffichees.map((_, i) => i);
      const racine = (i) => {
        while (parent[i] !== i) {
          parent[i] = parent[parent[i]];
          i = parent[i];
        }
        return i;
      };
      for (let i = 0; i < boutiquesAffichees.length; i++) {
        for (let j = i + 1; j < boutiquesAffichees.length; j++) {
          const proches = metres(boutiquesAffichees[i], boutiquesAffichees[j]) <= RAYON_GROUPE_M;
          const recouvertes = zoom < ZOOM_ANNEAU && Math.hypot(pixels[i].x - pixels[j].x, pixels[i].y - pixels[j].y) < DIAMETRE_AVATAR_PX;
          if (proches || recouvertes) parent[racine(i)] = racine(j);
        }
      }
      // Paires de bulles qui se touchent (mesurées à l'écran) : fusionnées en une seule.
      (carte.__pairesFusion || []).forEach(([u, v]) => {
        const i = boutiquesAffichees.findIndex((b) => b.id === u);
        const j = boutiquesAffichees.findIndex((b) => b.id === v);
        if (i >= 0 && j >= 0) parent[racine(i)] = racine(j);
      });
      const parRacine = new Map();
      boutiquesAffichees.forEach((b, i) => {
        const r = racine(i);
        if (!parRacine.has(r)) parRacine.set(r, []);
        parRacine.get(r).push(b.id);
      });
      // Aucun regroupement de bulles, sauf pour la touche « Arbre » (qui a besoin des groupes pour ranger les bulles autour d'un tronc).
      // Une bulle par FLEUR (les boutiques d'une fleur partagent un seul carrousel, avec leurs icônes de profil en tête) ; mode « Arbre » : groupes à 100 m rangés autour d'un tronc.
      const groupes = arbreActifRef.current ? [...parRacine.values()].filter((ids) => ids.length > 1) : (() => {
            // Groupes des fleurs, plus les paires de bulles qui se chevauchent (au moins 10 %) : leurs boutiques partagent alors une seule bulle (les épingles, elles, ne bougent pas).
            const liste = (carte.__groupesFleurs || []).map((g) => g.slice());
            const trouver = (id) => liste.findIndex((g) => g.includes(id));
            (carte.__pairesFusion || []).forEach(([u, v]) => {
              const iu = trouver(u);
              const iv = trouver(v);
              if (iu < 0 && iv < 0) liste.push([u, v]);
              else if (iu < 0) liste[iv].push(u);
              else if (iv < 0) liste[iu].push(v);
              else if (iu !== iv) {
                liste[iu].push(...liste[iv]);
                liste.splice(iv, 1);
              }
            });
            return liste;
          })();
      const chefDe = new Map(); // id -> ids du groupe (pour le chef seulement)
      const cache = new Set();
      if (arbreActifRef.current) {
        carte.__arbres = groupes; // chaque boutique garde sa bulle ; les groupes sont rangés en arbre (voir placerArbres)
      } else {
        groupes.forEach((ids) => {
          chefDe.set(ids[0], ids);
          ids.slice(1).forEach((id) => cache.add(id));
        });
      }
      const signature = groupes.map((g) => g.join("+")).join("|");
      carte.__groupesBulles = chefDe;
      if (carte.__signatureGroupes === signature) {
        setTimeout(ajouterPicsAssocies, 120);
        return;
      }
      carte.__signatureGroupes = signature;
      boutiquesAffichees.forEach((b) => {
        const h = popupsBoutiquesRef.current.get(b.id);
        if (!h) return;
        h.fermerFixe?.();
        if (cache.has(b.id)) return;
        const ids = chefDe.get(b.id);
        h.ouvrirFixe?.(ids ? construireHtmlGroupe(ids.map((id) => boutiquesAffichees.find((x) => x.id === id)).filter(Boolean)) : undefined);
      });
      setTimeout(ajouterPicsAssocies, 350);
      if (arbreActifRef.current) setTimeout(placerArbres, 450);
    };

    // Chaque bulle reste FIXE sur sa boutique (sa pointe vise le centre de l'épingle). Quand deux bulles se touchent à l'écran (dézoom), leurs boutiques sont
    // associées en UNE bulle ; on recommence jusqu'à ce qu'aucune ne se touche.
    const fusionnerBullesQuiSeTouchent = async () => {
      if (!bullesFixesRef.current || carteRef.current !== carte) return;
      const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
      // Déplacer la carte ne change rien aux bulles (elles suivent leurs boutiques) : la fusion n'est recalculée que si le ZOOM a changé, sinon aucune bulle ne se ferme ni ne se rouvre.
      const zoomFusion = carte.getZoom();
      // Bulles ouvertes telles quelles (une par boutique) ; en mode « Arbre », rangées autour du tronc. Puis la carte descend si elles dépassent sous les couches du haut.
      appliquerBullesFixes();
      await attendre(650);
      if (!bullesFixesRef.current || carteRef.current !== carte) return;
      if (arbreActifRef.current) placerArbres();
      await attendre(250);
      const doitRecalculer = !arbreActifRef.current && carte.__zoomFusion !== zoomFusion; // fusion des bulles qui se chevauchent, recalculée au changement de zoom
      // Applique les groupes courants, attend que toutes les bulles aient fini de se placer, puis renvoie les paires de bulles qui se touchent
      // (null si la carte a changé entre-temps).
      const appliquerEtMesurer = async () => {
        appliquerBullesFixes();
        let derniere = "";
        for (let essai = 0; essai < 14; essai++) {
          await attendre(150);
          const sig = boutiquesAffichees
            .map((b) => popupsBoutiquesRef.current.get(b.id)?.mesurerBulle?.())
            .filter(Boolean)
            .map((r) => [r.left, r.top, r.width, r.height].map(Math.round).join(","))
            .join(";");
          if (sig && sig === derniere) break;
          derniere = sig;
        }
        if (!bullesFixesRef.current || carteRef.current !== carte) return null;
        const mesures = boutiquesAffichees
          .map((b) => ({ id: b.id, r: popupsBoutiquesRef.current.get(b.id)?.mesurerBulle?.() }))
          .filter((m) => m.r && m.r.width > 0);
        const paires = [];
        for (let i = 0; i < mesures.length; i++) {
          for (let j = i + 1; j < mesures.length; j++) {
            const a = mesures[i].r;
            const c = mesures[j].r;
            // Fusion seulement si les bulles se chevauchent d'au moins 10 % de la plus petite (de simples voisines, même proches, restent séparées).
            const largeurCommune = Math.min(a.right, c.right) - Math.max(a.left, c.left);
            const hauteurCommune = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
            if (largeurCommune <= 0 || hauteurCommune <= 0) continue;
            const petite = Math.min(a.width * a.height, c.width * c.height);
            if ((largeurCommune * hauteurCommune) / petite >= 0.1) paires.push([mesures[i].id, mesures[j].id]);
          }
        }
        return paires;
      };
      if (doitRecalculer) {
        carte.__pairesFusion = [];
        carte.__descentes = 0; // nouveau zoom : la carte peut de nouveau descendre pour que les bulles passent sous les couches du haut
      }
      for (let tour = 0; doitRecalculer && tour < 10; tour++) {
        const nouvelles = await appliquerEtMesurer();
        if (nouvelles === null) return;
        if (!nouvelles.length) break;
        carte.__pairesFusion.push(...nouvelles);
      }
      // Fusion MINIMALE : chaque paire est retirée à tour de rôle ; si plus aucune bulle ne se touche sans elle, elle reste retirée (une boutique éloignée n'est jamais fusionnée à tort).
      const aEssayer = doitRecalculer ? [...carte.__pairesFusion] : [];
      for (const paire of aEssayer.slice(0, 8)) {
        const sans = carte.__pairesFusion.filter((q) => q !== paire);
        const avant = carte.__pairesFusion;
        carte.__pairesFusion = sans;
        const reste = await appliquerEtMesurer();
        if (reste === null) return;
        if (reste.length) carte.__pairesFusion = avant;
      }
      appliquerBullesFixes();
      carte.__zoomFusion = zoomFusion;
      // Une seule fois : si des bulles dépassent sous la barre du haut, la carte descend d'autant (les bulles restent collées à leurs boutiques).
      const c = carte.getContainer().getBoundingClientRect();
      // Bas de TOUT ce qui recouvre le haut de la carte : en-tête, barre de recherche et rangée de touches (Carrousel…).
      const racine = carte.getContainer().closest('[role="dialog"]') || document;
      const rangeeTouches = [...racine.querySelectorAll("button")].find((bt) => bt.textContent.trim() === "Carrousel")?.parentElement;
      const hautDesCouches = [headerRef.current, rangeeTouches, ...racine.querySelectorAll("form")]
        .filter(Boolean)
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.height > 0 && r.top < c.top + 320)
        .map((r) => r.bottom);
      const haut = Math.max(c.top, ...hautDesCouches) + 6;
      const visibles = boutiquesAffichees
        .map((b) => popupsBoutiquesRef.current.get(b.id)?.mesurerBulle?.())
        .filter((m) => m && m.right > c.left && m.left < c.right && m.top > c.top - 400 && m.top < c.bottom);
      const deficit = visibles.length ? Math.max(0, haut - Math.min(...visibles.map((m) => m.top))) : 0;
      if (deficit > 2 && (carte.__descentes || 0) < 4) {
        carte.__descentes = (carte.__descentes || 0) + 1;
        carte.panBy([0, -Math.ceil(deficit)], { animate: true, duration: 0.35 });
      }
    };

    basculerBullesFixesRef.current = (ouvert) => {
      bullesFixesRef.current = ouvert;
      carte.__signatureGroupes = null;
      // Carrousel actif : les bulles passent DEVANT les épingles (610 > 600), sinon la zone transparente d'une épingle voisine recouvre leurs boutons et bloque les touchers.
      carte.getPane("popupPane").style.zIndex = ouvert ? 610 : 590;
      if (ouvert) appliquerBullesFixes();
      else
        boutiquesAffichees.forEach((b) => {
          popupsBoutiquesRef.current.get(b.id)?.fermerFixe?.();
        });
      if (carte.__eviterBulles) carte.off("moveend zoomend", carte.__eviterBulles);
      if (!ouvert) {
        carte.__arbres = [];
        effacerArbres();
        carte.getContainer().querySelectorAll(".leaflet-popup-tip-container").forEach((t) => (t.style.display = ""));
      }
      if (carte.__effacerLiens) carte.off("movestart zoomstart", carte.__effacerLiens);
      carte.__effacerLiens = null;
      effacerLiens();
      clearTimeout(carte.__minuterieBulles);
      carte.__eviterBulles = null;
      carte.__descentes = 0;
      carte.__pairesFusion = [];
      carte.__zoomFusion = null;
      if (ouvert) {
        // Chaque déplacement ou zoom de la carte remet les bulles à leur place d'origine (voir rafraichirPopup) : le placement est donc recalculé juste après, une fois la carte
        // immobile (délai court, regroupé en un seul calcul).
        carte.__eviterBulles = () => {
          clearTimeout(carte.__minuterieBulles);
          carte.__minuterieBulles = setTimeout(fusionnerBullesQuiSeTouchent, 250);
        };
        carte.on("moveend zoomend", carte.__eviterBulles);
        carte.__effacerLiens = effacerLiens;
        carte.on("movestart zoomstart", effacerLiens);
        carte.__eviterBulles();
      }
    };
    if (carrousselCarteOuvertRef.current) basculerBullesFixesRef.current(true);

    // Mode « focus » : tant qu'une boutique est fixée (bulle d'articles ouverte), seules elle et « Vous êtes
    // ici » restent visibles ; les autres boutiques, leurs bulles de regroupement et leurs traits sont
    // masqués par CSS (globals.css, .carte-focus-boutique). Sert aux boutiques proches dont les avatars
    // et les bulles se recouvraient au point d'être intouchables.
    function appliquerFocusBoutique() {
      if (carteRef.current !== carte) return;
      const id = boutiqueEpingleeIdRef.current;
      carte.getContainer().classList.toggle("carte-focus-boutique", Boolean(id));
      marqueursCreesParId.forEach((entree, cle) => {
        entree.marqueur?.getElement?.()?.classList.toggle("marqueur-focus", Boolean(id) && cle === id);
      });
    }
    // Toucher le fond de la carte referme la boutique fixée (et fait revenir les autres).
    if (carte.__surClicFond) carte.off("click", carte.__surClicFond);
    carte.__surClicFond = () => {
      if (boutiqueEpingleeIdRef.current) {
        boutiqueEpingleeIdRef.current = null;
        carte.closePopup();
        appliquerFocusBoutique();
      }
    };
    carte.on("click", carte.__surClicFond);
    appliquerFocusBoutique();

    // Enregistre "Vous êtes ici" dans le même registre que les boutiques
    // (clé dédiée "__ici__") pour que recalculerDissociations puisse aussi
    // le déplacer/le tracer s'il chevauche une boutique — voir le
    // commentaire dans recalculerDissociations ci-dessus.
    if (marqueurMoiRef.current && positionOrigineMoiRef.current) {
      marqueursCreesParId.set("__ici__", { marqueur: marqueurMoiRef.current, decalage: { dx: 0, dy: 0 }, decalageBas: false, ancre: [14, 14], rafraichirPopup: null });
    }

    // Application initiale de la dissociation automatique, puis recalcul à
    // chaque pan/zoom (l'écart en pixels dépend du niveau de zoom courant —
    // des boutiques superposées à un zoom peuvent ne plus l'être à un
    // autre, et inversement). Différé via setTimeout(...,0) : "moveend"
    // peut se déclencher de façon SYNCHRONE en plein milieu d'un
    // setView/fitBounds, avant que Leaflet ait fini de réinitialiser ses
    // bounds internes — ajouter/déplacer une polyline à cet instant précis
    // fait planter le rendu interne de Leaflet (bounds encore incomplets).
    // carteRef.current === carte évite d'agir si la carte a été recréée
    // entre-temps (rafraichirMarqueurs peut être rappelé avant que ce
    // timer ne se déclenche).
    const gestionnaireDissociation = () =>
      setTimeout(() => {
        if (carteRef.current === carte) recalculerDissociations();
      }, 0);
    // Calculs sans effet sur les calques Leaflet (seulement du style DOM) :
    // sûrs en plein zoomanim, donc appliqués SYNCHRONEMENT. zoomanim = zoom
    // CIBLE (dès le début d'un geste animé ou d'un pincement, à chaque
    // cadre) ; zoom = vol/zoom instantané, cadre par cadre ; zoomend/moveend
    // = filet de sécurité (positionnement initial, fin de vol).
    const surZoomAnim = (e) => {
      if (carteRef.current === carte) recalculerDissociations(e.zoom);
    };
    const surZoom = () => {
      if (carteRef.current === carte && !carte._animatingZoom) recalculerDissociations();
    };
    gestionnaireDissociation();
    carte.on("zoomanim", surZoomAnim);
    carte.on("zoom", surZoom);
    // 01/11/2026 : barre de pourcentage de zoom TEMPORAIRE (demande de l'utilisateur, à retirer sur sa demande).
    carte.getContainer().querySelectorAll("[data-barre-zoom]").forEach((e) => e.remove()); // jamais deux barres (cet effet se rejoue)
    const barreZoom = document.createElement("div");
    barreZoom.setAttribute("data-barre-zoom", "1");
    barreZoom.style.cssText = "position:absolute;left:10px;top:50%;transform:translateY(-50%);z-index:1200;display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 6px;border-radius:14px;background:rgba(15,23,42,.82);color:#fff;font:700 12px system-ui,sans-serif;pointer-events:none;";
    barreZoom.innerHTML = '<span data-valeur>0%</span><div style="width:8px;height:120px;border-radius:9999px;background:rgba(255,255,255,.25);position:relative;overflow:hidden"><div data-remplissage style="position:absolute;left:0;right:0;bottom:0;height:0;background:#3B82F6"></div></div>';
    carte.getContainer().appendChild(barreZoom);
    const majBarreZoom = () => {
      const pc = Math.max(0, Math.min(100, Math.round((carte.getZoom() / 18) * 100)));
      barreZoom.querySelector("[data-valeur]").textContent = pc + "%";
      barreZoom.querySelector("[data-remplissage]").style.height = pc + "%";
    };
    majBarreZoom();
    carte.on("zoom zoomend", majBarreZoom);
    carte.on("zoomend", gestionnaireDissociation);
    carte.on("moveend", gestionnaireDissociation);

    // Détache les écouteurs précédents avant d'en reposer : ce callback est
    // rappelé à chaque rafraîchissement des marqueurs (pas seulement à la
    // création de la carte), sans ça chaque passage en accumulerait un de
    // plus sur le même objet carte.
    if (echelleZoomCleanupRef.current) {
      echelleZoomCleanupRef.current();
    }
    // Taille constante des avatars : plus de mise à l'échelle selon le zoom.
    echelleZoomCleanupRef.current = null;

    if (dissociationCleanupRef.current) {
      dissociationCleanupRef.current();
    }
    dissociationCleanupRef.current = () => {
      carte.off("zoomanim", surZoomAnim);
      carte.off("zoom", surZoom);
      carte.off("zoomend", gestionnaireDissociation);
      carte.off("moveend", gestionnaireDissociation);
    };
  }, [boutiquesAffichees, boutiqueSelectionnee, gererClicPointCluster, obtenirMembresConnus, photosArticlesRecherche]);
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
  // Pendant une recherche, la boutique sélectionnée doit faire partie des résultats : sinon la bannière
  // et la fiche resteraient sur une boutique qui n'est plus affichée.
  useEffect(() => {
    if (!rechercheNormalisee || boutiquesAffichees.length === 0) return;
    if (boutiquesAffichees.some((b) => b.id === boutiqueSelectionnee?.id)) return;
    const premiere = boutiquesAffichees[0];
    queueMicrotask(() => setBoutiqueSelectionnee(premiere));
  }, [rechercheNormalisee, boutiquesAffichees, boutiqueSelectionnee]);

  const clefBoutiquesRecherche = rechercheNormalisee ? boutiquesAffichees.map((b) => b.id).join(",") : "";
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

  // Pendant une recherche, des boutiques trouvées sur toute la plateforme arrivent APRÈS la frappe :
  // la carte est alors entièrement recréée (elle revient à son centre initial). Une fois la nouvelle
  // carte prête, on la recentre sur les résultats. Hors recherche, rien n'est recentré ici.
  useEffect(() => {
    if (!rechercheNormalisee || !cartePrete || boutiquesAffichees.length === 0) return;
    const carte = carteRef.current;
    if (!carte) return;
    (async () => {
      const L = (await import("leaflet")).default;
      carte.fitBounds(L.latLngBounds(boutiquesAffichees.map((b) => [b.lat, b.lng])), {
        padding: [28, 28],
        maxZoom: 15,
      });
    })();
    // boutiquesAffichees : la clé des identifiants suffit (évite un recentrage à chaque rendu).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartePrete, rechercheNormalisee, clefBoutiquesRecherche]);

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

    // Point bleu de position, IDENTIQUE à celui de l'application (CarteLeaflet.tsx) : 22 px, bordure blanche, halo doux, style Google Maps, sans étiquette.
    // Avant : un rond de 48 px + un halo de 80 px + une étiquette, qui cachaient les boutiques voisines.
    const htmlMoi = `
      <div class="marqueur-decale">
        ${htmlTraitRappel(14, 14)}
        <div class="marqueur-decale-contenu">
          <div class="relative flex justify-center select-none cursor-pointer">
            <div style="margin-top:3px;width:22px;height:22px;border-radius:9999px;background:#4285F4;border:3px solid #fff;box-sizing:border-box;box-shadow:0 0 0 7px rgba(66,133,244,.25),0 2px 6px rgba(0,0,0,.45)"></div>
          </div>
        </div>
      </div>
    `;

    const iconeMoi = L.divIcon({
      html: htmlMoi,
      className: "snap-custom-moi",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    // Pane dédié SOUS markerPane (600) et au-dessus des tracés (400) depuis le 01/11/2026 : les épingles des boutiques passent toujours
    // devant le petit point « Vous êtes ici » (avant : au-dessus d'elles, 640, avec un badge de 84 px qui les cachait). Il n'intercepte plus le survol/le clic des boutiques
    // voisines : l'élément du marqueur est en pointer-events:none et seul
    // son contenu visible reçoit les événements (voir globals.css,
    // .snap-custom-moi) — c'était la raison de l'ancien pane SOUS les
    // marqueurs (correctifs v92/v96).
    if (!carte.getPane("paneMoi")) {
      carte.createPane("paneMoi");
      carte.getPane("paneMoi").style.zIndex = 590;
    }

    marqueurMoiRef.current = L.marker([pos.latitude, pos.longitude], { icon: iconeMoi, pane: "paneMoi", title: "Vous êtes ici" }).addTo(carte);
    positionOrigineMoiRef.current = [pos.latitude, pos.longitude];
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
    // Ré-enregistre "Vous êtes ici" dans le registre de dissociation : sans
    // ça, un badge créé APRÈS le dernier rafraîchissement des marqueurs
    // (bouton "Autour de moi" du globe) n'était jamais écarté d'une boutique
    // superposée.
    rafraichirMarqueursRef.current?.();
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
    if (positionInitiale && cartePrete && !rechercheActiveRef.current) {
      const cle = `${positionInitiale.latitude},${positionInitiale.longitude}`;
      if (dernierePositionAutoRef.current !== cle) {
        dernierePositionAutoRef.current = cle;
        centrerSurPosition(positionInitiale, { animer: false });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionInitiale, cartePrete]);

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
      className="snap-map-plein-ecran fixed inset-0 z-[2000] flex flex-col bg-[#0B0F17] overflow-hidden select-none font-sans"
      role="dialog"
      aria-modal="true"
      aria-label="Facilité Snap Map Sénégal"
    >
      {itineraireCible && trajetInfo && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 px-4 py-2.5 rounded-2xl bg-white dark:bg-zinc-900 shadow-xl text-center max-w-[90%] pointer-events-none">
          <p className="text-sm font-black text-zinc-900 dark:text-white truncate">{itineraireCible.nom}</p>
          <p className="text-xs font-bold text-blue-600">{trajetInfo.texte}</p>
          {trajetInfo.note && <p className="text-[11px] text-zinc-500 mt-0.5">{trajetInfo.note}</p>}
        </div>
      )}

      {/* 1. EN-TÊTE SUPÉRIEUR SNAP MAP (Sombre, Météo Dakar/Thiès & Filtres) */}
      <header
        ref={headerRef}
        className="absolute top-0 inset-x-0 z-20 pt-3 pb-2 px-3 sm:px-5 bg-gradient-to-b from-black/90 via-black/50 to-transparent pointer-events-none flex flex-col gap-2"
      >
        {/* Comme l'application : barre de recherche tout en haut, bouton de fermeture à sa droite (le titre « Dakar · Thiès », la météo et le compteur sont retirés). */}
        <button
          type="button"
          onClick={onFermer}
          className="pointer-events-auto absolute top-3 right-3 sm:right-5 w-11 h-11 rounded-full text-white flex items-center justify-center cursor-pointer transition backdrop-blur-md shadow-xl"
          style={{ backgroundColor: "rgba(20,24,33,0.78)" }}
          aria-label="Fermer la carte"
          title="Retourner à Locaux"
        >
          <i className="fa-solid fa-xmark text-base"></i>
        </button>

        {/* Recherche mot-clé haute-fidélité (Inspiration E-Commerce / AliExpress) :
            Contour orange vif (#FF5500), scan photo IA par caméra, bouton dégradé chaud "Rechercher",
            filtre instantané des marqueurs carte et dock articles. */}
        <div ref={barreRechercheRef} className="pointer-events-auto relative" style={{ width: "calc(100% - 56px)" }}>
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
            style={{ backgroundColor: "#EAE3D2", borderColor: "#EAE3D2", borderRadius: 18 }}
            className="relative flex items-center w-full bg-[#e3dbcc] rounded-[18px] border-2 border-[#e3dbcc] shadow-xl p-1 pl-3.5 sm:pl-4 transition-all duration-300 focus-within:ring-2 focus-within:ring-[#c4b89f]"
          >
            <input
              ref={inputRechercheRef}
              type="text"
              value={rechercheCarte}
              onChange={(e) => {
                setRechercheCarte(e.target.value);
                setMessageScan("");
              }}
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
              className={`relative flex items-center justify-center w-8 h-8 rounded-full text-stone-800 transition group mr-1.5 shrink-0 ${
                iaAutorisee ? "hover:bg-black/5 hover:text-black cursor-pointer" : "opacity-40 grayscale cursor-not-allowed"
              }`}
              title={iaAutorisee ? "Rechercher par photo (IA Scanner Vision)" : `Recherche par photo : ${MESSAGE_IA_EN_PAUSE.toLowerCase()}`}
              aria-disabled={!iaAutorisee}
            >
              <input
                ref={fileInputPhotoRef}
                type="file"
                accept="image/*"
                onChange={handleScanPhotoRecherche}
                className="hidden"
                disabled={scanPhotoEnCours || !iaAutorisee}
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
        <div
          onMouseDown={onMouseDownPastilles}
          onMouseMove={onMouseMovePastilles}
          onMouseUp={onMouseUpPastilles}
          onMouseLeave={onMouseUpPastilles}
          className="pointer-events-auto flex items-center gap-2 overflow-x-auto overscroll-x-contain no-scrollbar py-1 cursor-grab active:cursor-grabbing"
        >
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

          {/* Touche « Carrousel » : un toucher ouvre et fixe la bulle (carrousel d'articles) de toutes les boutiques de la carte ; un second toucher les ferme. */}
          <button
            type="button"
            onClick={() => setCarrousselCarteOuvert((v) => !v)}
            aria-pressed={carrousselCarteOuvert}
            className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shadow-md backdrop-blur-md ${
              carrousselCarteOuvert
                ? "bg-white text-gray-950 font-black shadow-white/20"
                : "bg-gray-900/80 text-white hover:bg-gray-800 border border-gray-700/80"
            }`}
          >
            <i className="fa-solid fa-images text-xs text-pink-400"></i>
            <span>Carrousel</span>
          </button>
          {carte3dActive() && (
            <button
              type="button"
              onClick={() => window.location.assign("/carte-3d")}
              className="px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shadow-md backdrop-blur-md bg-gray-900/80 text-white hover:bg-gray-800 border border-gray-700/80"
              title="Carte 3D (prototype)"
            >
              <i className="fa-solid fa-cube text-xs text-sky-400"></i>
              <span>3D</span>
            </button>
          )}
          {carrousselCarteOuvert && (
            <button
              type="button"
              onClick={() => setArbreActif((v) => !v)}
              aria-pressed={arbreActif}
              className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shadow-md backdrop-blur-md ${
                arbreActif ? "bg-white text-gray-950 font-black shadow-white/20" : "bg-gray-900/80 text-white hover:bg-gray-800 border border-gray-700/80"
              }`}
            >
              <i className="fa-solid fa-sitemap text-xs text-sky-400"></i>
              <span>Arbre</span>
            </button>
          )}

          {/* « Trouver un livreur » : livreurs accrédités de la zone (compte connecté requis pour les contacter). */}
{livreurAutorise && (
          <button
            type="button"
            onClick={() => setLivreursOuverts(true)}
            className="px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap bg-gray-900/80 hover:bg-gray-800 text-white border border-gray-700/80 transition cursor-pointer flex items-center gap-1.5 shadow-md backdrop-blur-md"
          >
            <i className="fa-solid fa-motorcycle text-xs text-amber-400"></i>
            <span>Trouver un livreur</span>
          </button>
)}
        </div>
      </header>

      {livreursOuverts && livreurAutorise && <ModalTrouverLivreur onFermer={() => setLivreursOuverts(false)} />}

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

        {/* 3. CONTRÔLES FLOTTANTS SNAP MAP (À droite) — top mesuré sur la
            vraie hauteur de l'en-tête (hauteurEntete), pas un décalage fixe
            deviné qui se désynchronise dès que l'en-tête change de hauteur. */}
        <aside
          className="absolute right-3.5 z-20 flex flex-col gap-2.5"
          style={{ top: hauteurEntete + 12 }}
        >
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
          <div
            className="absolute left-1/2 -translate-x-1/2 z-30 bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-2xl shadow-2xl max-w-[85%] text-center"
            style={{ top: hauteurEntete + 12 }}
          >
            {erreurLocalisation}
          </div>
        )}

        {/* 4. CARROUSEL INFÉRIEUR DE STORIES & BOUTIQUES (Style Snap Map Dock) */}
        <div
          ref={dockRef}
          className="absolute bottom-4 inset-x-0 z-20 px-3 sm:px-6 flex flex-col items-center gap-2 pointer-events-none"
        >
          {/* 02/11/2026 : la carte du bas (Itinéraire / Appeler / WhatsApp / Partager) ne s'ouvre plus au toucher d'une épingle (demande de l'utilisateur). */}
          {/* Pilule d'information active */}
          <div className="pointer-events-auto px-4 py-2 rounded-full bg-[#1877F2]/95 hover:bg-[#1877F2] text-white text-xs font-extrabold shadow-2xl backdrop-blur-md border border-white/20 flex items-center gap-2 cursor-pointer transition transform hover:scale-102">
            <i className="fa-solid fa-house text-xs"></i>
            <span>
              {messageScan
                ? messageScan
                : rechercheNormalisee && boutiquesAffichees.length === 0
                ? `Aucun résultat pour « ${rechercheCarte.trim()} »`
                : boutiqueSelectionnee
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

          {/* Carrousel Circulaire Interactif façon Snapchat / Stories Lens avec Flèches de Déplacement */}
          <div className="pointer-events-auto relative w-full max-w-xl flex items-center justify-center gap-1.5 sm:gap-2 px-1 select-none">
            {/* Bouton Flèche Gauche Précédent */}
            <button
              type="button"
              onClick={vueCarrousel === "boutiques" ? allerBoutiquePrecedente : allerArticlePrecedent}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center justify-center text-xs backdrop-blur-md shadow-lg active:scale-90 transition cursor-pointer shrink-0 z-30 group"
              aria-label={vueCarrousel === "boutiques" ? "Boutique précédente" : "Article précédent"}
              title={vueCarrousel === "boutiques" ? "Boutique précédente" : "Article précédent"}
            >
              <i className="fa-solid fa-chevron-left text-xs group-hover:-translate-x-0.5 transition-transform"></i>
            </button>

            {vueCarrousel === "boutiques" ? (
              <div
                ref={carouselContainerRef}
                onMouseDown={onMouseDownCarousel}
                onMouseMove={onMouseMoveCarousel}
                onMouseUp={onMouseUpCarousel}
                onMouseLeave={onMouseUpCarousel}
                onWheel={(e) => {
                  e.stopPropagation();
                  if (carouselContainerRef.current) {
                    const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
                    if (delta !== 0) {
                      carouselContainerRef.current.scrollLeft += delta * 1.1;
                    }
                  }
                }}
                className="flex-1 bg-white/10 backdrop-blur-md rounded-full py-1.5 px-3 sm:px-5 flex items-center justify-start gap-1 sm:gap-1.5 overflow-x-auto overscroll-x-contain no-scrollbar scroll-smooth cursor-grab active:cursor-grabbing touch-pan-x"
              >
                {/* Espaceurs de centrage : sans eux, le 1er/dernier avatar ne
                    peut jamais atteindre le centre visuel (rien à faire
                    défiler après/avant lui) — l'anneau actif se retrouvait
                    décalé sur les bords au lieu de rester fixe au centre.
                    Demande explicite de l'utilisateur ("ça doit être fixe
                    ici"). Plafonnés à 56px (≈ largeur d'un avatar
                    sélectionné) : sans plafond, calc(50% - 27px) pouvait
                    dépasser 100px avec peu de boutiques dans un dock large,
                    laissant une zone transparente immense de chaque côté —
                    signalé par l'utilisateur. */}
                <div aria-hidden="true" className="shrink-0" style={{ width: "min(calc(50% - 27px), 90px)" }} />
                {(rechercheNormalisee ? boutiquesAffichees : marqueurs).map((b, idx) => {
                  const avatar = AVATARS_SNAP[idx % AVATARS_SNAP.length];
                  const aPhoto = b.photo ? urlPhoto(b.photo) : null;
                  const estSelectionne = boutiqueSelectionnee ? boutiqueSelectionnee.id === b.id : idx === 0;

                  return (
                    <button
                      key={b.id || idx}
                      data-boutique-id={b.id}
                      type="button"
                      onClick={(e) => selectionnerBoutiqueCarousel(b, e.currentTarget)}
                      onPointerEnter={(e) => {
                        if (e.pointerType !== "mouse") return;
                        const handler = popupsBoutiquesRef.current.get(b.id);
                        if (handler) {
                          handler.ouvrir();
                          carteRef.current?.panTo([b.lat, b.lng], { animate: true, duration: 0.4 });
                        }
                      }}
                      onPointerLeave={(e) => {
                        if (e.pointerType !== "mouse") return;
                        popupsBoutiquesRef.current.get(b.id)?.fermer();
                      }}
                      className="flex flex-col items-center shrink-0 cursor-pointer group snap-center transition-all duration-300 focus:outline-none"
                    >
                      {/* Cercle Avatar façon Lens Snapchat (Capture 1) */}
                      <div
                        className={`relative rounded-full transition-all duration-300 flex items-center justify-center ${
                          estSelectionne
                            ? "w-12 h-12 sm:w-13 sm:h-13 p-[3px] bg-white shadow-[0_0_22px_rgba(255,255,255,0.9),0_8px_22px_rgba(0,0,0,0.75)] ring-2 ring-black/50 scale-110 z-20"
                            : "w-12 h-12 sm:w-13 sm:h-13 p-[1.5px] bg-white/25 opacity-90 hover:opacity-100 hover:scale-105 shadow-sm"
                        }`}
                      >
                        <div className="w-full h-full rounded-full overflow-hidden bg-gray-900 flex items-center justify-center border-2 border-black">
                          {b.logo_url || b.avatar_config ? (
                            <img
                              src={b.logo_url || dataUriAvatarBoutique(b.avatar_config, 64)}
                              alt={b.nom}
                              className="w-full h-full object-cover pointer-events-none"
                            />
                          ) : aPhoto ? (
                            <img src={aPhoto} alt={b.nom} className="w-full h-full object-cover pointer-events-none" />
                          ) : (
                            <span className={estSelectionne ? "text-2xl" : "text-xl"}>{avatar.emoji}</span>
                          )}
                        </div>

                        {b.estPremium && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-gray-950 flex items-center justify-center text-[8px] font-black border border-white shadow-xs">
                            👑
                          </span>
                        )}
                      </div>

                      {/* Libellé Boutique — seulement pour l'élément sélectionné,
                          façon Snapchat Lenses (référence utilisateur) : une
                          rangée dense de cercles, pas une légende sous chacun. */}
                      {estSelectionne && (
                        <span className="mt-1.5 px-2.5 py-0.5 bg-white text-gray-950 text-[10px] sm:text-[11px] font-black rounded-full shadow-xl max-w-[80px] sm:max-w-[100px] truncate border border-gray-200 transition-all duration-200">
                          {b.nom}
                        </span>
                      )}
                    </button>
                  );
                })}
                <div aria-hidden="true" className="shrink-0" style={{ width: "min(calc(50% - 27px), 90px)" }} />
              </div>
            ) : (
              <div
                ref={carouselContainerRef}
                onMouseDown={onMouseDownCarousel}
                onMouseMove={onMouseMoveCarousel}
                onMouseUp={onMouseUpCarousel}
                onMouseLeave={onMouseUpCarousel}
                onWheel={(e) => {
                  e.stopPropagation();
                  if (carouselContainerRef.current) {
                    const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
                    if (delta !== 0) {
                      carouselContainerRef.current.scrollLeft += delta * 1.1;
                    }
                  }
                }}
                className="flex-1 bg-white/10 backdrop-blur-md rounded-full py-1.5 px-3 sm:px-5 flex items-center justify-start gap-1 sm:gap-1.5 overflow-x-auto overscroll-x-contain no-scrollbar scroll-smooth cursor-grab active:cursor-grabbing touch-pan-x"
              >
                {articlesFiltres.length === 0 ? (
                  <p className="text-[11px] text-gray-400 font-bold px-4 py-2">
                    Aucun article ne correspond à cette recherche.
                  </p>
                ) : (
                  <>
                    <div aria-hidden="true" className="shrink-0" style={{ width: "min(calc(50% - 27px), 90px)" }} />
                    {articlesFiltres.map((a) => {
                    const photo = a.photos?.[0] || null;
                    const estSelectionne = articleActifEffectif ? articleActifEffectif.id === a.id : false;
                    return (
                      <button
                        key={a.id}
                        data-article-id={a.id}
                        type="button"
                        onClick={(e) => selectionnerArticleCarousel(a, e.currentTarget)}
                        className="flex flex-col items-center shrink-0 cursor-pointer group snap-center transition-all duration-300 focus:outline-none"
                      >
                        <div
                          className={`relative rounded-full transition-all duration-300 flex items-center justify-center ${
                            estSelectionne
                              ? "w-13 h-13 sm:w-14 sm:h-14 p-[3px] bg-white shadow-[0_0_22px_rgba(255,255,255,0.9),0_8px_22px_rgba(0,0,0,0.75)] ring-2 ring-black/50 scale-105 z-20"
                              : "w-12 h-12 sm:w-13 sm:h-13 p-[1.5px] bg-white/25 opacity-90 hover:opacity-100 hover:scale-105 shadow-sm"
                          }`}
                        >
                          <div className="w-full h-full rounded-full overflow-hidden bg-gray-900 border border-gray-950 flex items-center justify-center">
                            {photo ? (
                              <img src={photo} alt={a.titre} className="w-full h-full object-cover pointer-events-none" />
                            ) : (
                              <i className="fa-solid fa-tag text-gray-400 text-xs"></i>
                            )}
                          </div>
                        </div>
                        {estSelectionne && (
                          <>
                            <span className="mt-1.5 px-2 py-0.5 bg-white text-gray-950 text-[10px] font-black rounded-full shadow-xl max-w-[80px] truncate transition-all duration-200">
                              {a.titre}
                            </span>
                            <span className="text-[8px] font-black text-emerald-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                              {prixLisible(a.prix_xof)} F
                            </span>
                          </>
                        )}
                      </button>
                    );
                    })}
                    <div aria-hidden="true" className="shrink-0" style={{ width: "min(calc(50% - 27px), 90px)" }} />
                  </>
                )}
              </div>
            )}

            {/* Bouton Flèche Droite Suivant */}
            <button
              type="button"
              onClick={vueCarrousel === "boutiques" ? allerBoutiqueSuivante : allerArticleSuivant}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center justify-center text-xs backdrop-blur-md shadow-lg active:scale-90 transition cursor-pointer shrink-0 z-30 group"
              aria-label={vueCarrousel === "boutiques" ? "Boutique suivante" : "Article suivant"}
              title={vueCarrousel === "boutiques" ? "Boutique suivante" : "Article suivant"}
            >
              <i className="fa-solid fa-chevron-right text-xs group-hover:translate-x-0.5 transition-transform"></i>
            </button>
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
                    {boutiqueSelectionnee.logo_url || boutiqueSelectionnee.avatar_config ? (
                      <img
                        src={boutiqueSelectionnee.logo_url || dataUriAvatarBoutique(boutiqueSelectionnee.avatar_config, 48)}
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

              {/* Boutons d'action : WhatsApp + itinéraire GPS */}
              <div className="p-4 sm:p-5 border-b border-gray-800 bg-gray-950/60 space-y-2.5">
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
                {/* Itinéraire GPS — marqueurs déjà filtrés en amont (ligne
                    ~301) pour n'avoir que des lat/lng valides, donc toujours
                    exploitables ici sans vérification supplémentaire. */}
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${boutiqueSelectionnee.lat},${boutiqueSelectionnee.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 rounded-2xl bg-blue-950/40 hover:bg-blue-900/40 border border-blue-800/60 flex items-center gap-3 transition cursor-pointer"
                >
                  <i className="fa-solid fa-diamond-turn-right text-[#1877F2] text-lg shrink-0"></i>
                  <div className="text-left">
                    <p className="text-xs sm:text-sm font-black text-blue-300 leading-tight">M&apos;y rendre</p>
                    <p className="text-[11px] text-blue-400/70 leading-tight">Itinéraire GPS jusqu&apos;à la boutique</p>
                  </div>
                </a>
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
