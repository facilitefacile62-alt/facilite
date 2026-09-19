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
//
// Thème et fonctionnalités alignés sur GlobeExplorateurBoutiques ("Explorer")
// à la demande de l'utilisateur — mêmes pastilles de filtre, même marqueur
// "Vous êtes ici" animé, même carrousel d'avatars — mais SANS passer en plein
// écran : ce composant reste dans son cadre compact, intégré à côté de la
// liste de résultats, c'est la différence assumée avec le Globe.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { echapperHtml, calculerStatutOuverture, urlPhoto } from "@/lib/marketplaceData";
import { brancherEchelleZoomAvatars, dataUriAvatarBoutique, svgAvatarBoutique } from "@/lib/avatarBoutique";

const COULEUR = "#1877F2";
const COULEUR_SERVICE = "#F59E0B";
const COULEUR_ETABLISSEMENT = "#8B5CF6";
const LIBELLES_CATEGORIE_ETABLISSEMENT = {
  sante: "Santé",
  finance: "Finance",
  beaute: "Beauté",
  autre: "Établissement",
};
// Même filtre CSS que GlobeExplorateurBoutiques (voir ce fichier pour le
// détail) : OpenStreetMap ne fournit pas de style sombre nativement, on le
// simule par un filtre appliqué au seul pane des tuiles — les marqueurs
// restent intacts, aucun sélecteur CSS global qui affecterait d'autres cartes.
const FILTRE_TUILES_SOMBRE = "invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9)";

const PASTILLES_FILTRE = [
  { id: "tous", label: "Toutes les boutiques", icone: "fa-compass" },
  { id: "populaires", label: "Les plus visités", icone: "fa-trophy" },
  { id: "live", label: "En stock (LIVE)", icone: null },
];

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

export default function CarteBoutiques({ articles, boutiquesSansArticles = [], storeIdsPremium, depart, onChoisirBoutique, onOuvrirExplorer, onReinitialiserPosition }) {
  const conteneur = useRef(null);
  const carteRef = useRef(null);
  const leafletRef = useRef(null);
  const menuFiltresRef = useRef(null);
  const carouselContainerRef = useRef(null);
  const dragRef = useRef({ isDown: false, startX: 0, scrollLeft: 0, hasMoved: false });
  const popupsBoutiquesRef = useRef(new Map());
  const [boutiqueActiveId, setBoutiqueActiveId] = useState(null);
  const [echec, setEchec] = useState(false);

  // Fait suivre visuellement le dock quand la sélection change par les
  // flèches (qui bouclent déjà sur les index : dernier -> premier et
  // inversement) — sans ceci, la sélection "bouclait" bien côté données
  // (carte, popup) mais le dock restait scrollé où il était, donnant
  // l'impression que le bouclage n'existait pas. Signalé par l'utilisateur
  // ("ça doit faire le tour").
  useEffect(() => {
    if (!boutiqueActiveId || !carouselContainerRef.current) return;
    const el = carouselContainerRef.current.querySelector(`[data-boutique-id="${boutiqueActiveId}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [boutiqueActiveId]);

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

  // Cadre de sélection déplaçable/redimensionnable ("voir tout ce qu'il y a
  // là-dedans") — demande explicite de l'utilisateur, complémentaire à la
  // liste qui s'ouvre au clic sur des marqueurs superposés : ici on choisit
  // soi-même une zone plutôt que de cliquer précisément sur un point.
  const [modeSelectionActif, setModeSelectionActif] = useState(false);
  const [cadre, setCadre] = useState({ x: 70, y: 70, largeur: 150, hauteur: 150 });
  const dragEtatRef = useRef(null);

  // Popup listant plusieurs lieux (boutiques et/ou "Vous êtes ici") à
  // choisir — utilisé à la fois par le clic sur des marqueurs superposés
  // (voir l'effet Leaflet plus bas) et par le cadre de sélection ci-dessous.
  // Fonction de composant (pas locale à l'effet) : leafletRef/carteRef
  // restent valides tant que la carte est montée, indépendamment de quel
  // rendu de l'effet les a créés.
  const ouvrirListeCluster = useCallback(
    (position, membres) => {
      const carte = carteRef.current;
      const L = leafletRef.current;
      if (!carte || !L || membres.length === 0) return;
      // Carrousel d'avatars (même présentation que le carrousel du bas de
      // la carte) plutôt qu'une simple liste de texte — demande explicite
      // de l'utilisateur.
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
      // setContent ne monte le HTML qu'après ce tick — les gestionnaires ne
      // peuvent être attachés qu'une fois l'élément réellement présent.
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
              const handler = popupsBoutiquesRef.current.get(m.id);
              if (handler?.ouvrir) {
                handler.ouvrir();
              }
              if (typeof onChoisirBoutique === "function") {
                onChoisirBoutique(m.id);
              }
            }
          });
        });
      }, 0);
    },
    [onChoisirBoutique]
  );

  // États de contrôle : Pliée / Dépliée, Mode Gain d'espace (Compact) et Menu Déroulant des Filtres
  const [estPliee, setEstPliee] = useState(false);
  const [modeCompact, setModeCompact] = useState(false);
  const [menuFiltresOuvert, setMenuFiltresOuvert] = useState(false);
  // Filtre façon Explorer : 'tous' | 'populaires' | 'live'. Contrairement à
  // Explorer, "Autour de moi" n'est pas un filtre mais une action (recentrer
  // sur `depart`, déjà connu ici — pas besoin de re-géolocaliser).
  const [filtreActif, setFiltreActif] = useState("tous");

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuFiltresRef.current && !menuFiltresRef.current.contains(event.target)) {
        setMenuFiltresOuvert(false);
      }
    }
    if (menuFiltresOuvert) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [menuFiltresOuvert]);

  // Regroupement par boutique. Un seul pin par boutique quel que soit son
  // type_boutique (demande explicite) : les boutiques service/établissement
  // (sans aucun article — voir boutiquesSansArticles, déjà dédupliquées et
  // positionnées par le parent) rejoignent la même liste que les boutiques
  // produit ci-dessous, sans traitement spécial ici hormis le type qui
  // détermine l'icône (voir plus bas).
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
          type_boutique: a.type_boutique || "produit",
          mode_horaires: a.boutique_mode_horaires || a.mode_horaires || "indiques",
          horaires: a.horaires || a.boutique_horaires || [],
          avatar_config: a.boutique_avatar_config || null,
          estPremium: storeIdsPremium?.has(a.boutique_id) || false,
          articles: [],
        });
      }
      par.get(cle).articles.push(a);
    }
    for (const s of boutiquesSansArticles || []) {
      const p = point(s.lat, s.lng);
      if (!p || par.has(s.id)) continue;
      par.set(s.id, {
        id: s.id,
        nom: s.nom || "Boutique",
        quartier: s.quartier || null,
        distance_km: s.distance_km,
        position: p,
        type_boutique: s.type_boutique,
        metier: s.metier,
        description_prestation: s.description_prestation,
        categorie_etablissement: s.categorie_etablissement,
        whatsappUrl: s.whatsappUrl,
        mode_horaires: s.mode_horaires || "indiques",
        horaires: s.horaires || [],
        avatar_config: s.avatar_config || null,
        estPremium: storeIdsPremium?.has(s.id) || false,
        articles: [],
      });
    }
    // Priorité de position (Premium Marketplace) : tri stable, Premium
    // d'abord — voir boutiquesPourGlobe (MarketplaceClient.jsx) pour le
    // même raisonnement, appliqué ici au regroupement propre à ce
    // composant (construit séparément, à partir des mêmes props articles/
    // boutiquesSansArticles).
    return [...par.values()].sort((a, b) => (b.estPremium ? 1 : 0) - (a.estPremium ? 1 : 0));
  }, [articles, boutiquesSansArticles, storeIdsPremium]);

  // Boutiques affichées selon la pastille active — filtre à la fois les
  // marqueurs dessinés sur la carte et le carrousel du bas, comme Explorer.
  const boutiquesAffichees = useMemo(() => {
    if (filtreActif === "live") {
      return boutiques.filter((b) => b.articles.some((a) => a.statut === "en_stock"));
    }
    if (filtreActif === "populaires") {
      return boutiques.slice(0, Math.max(3, Math.ceil(boutiques.length / 2)));
    }
    return boutiques;
  }, [boutiques, filtreActif]);

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

  // Convertit le cadre (coordonnées écran, relatives au conteneur de la
  // carte) en zone géographique, puis liste tout ce qui s'y trouve —
  // boutiques ET "Vous êtes ici" — via la même popup que le clic sur des
  // marqueurs superposés. Demande explicite de l'utilisateur : un outil
  // qu'on positionne pour voir toutes les boutiques d'une zone, plutôt que
  // de devoir cliquer précisément sur chacune.
  const voirBoutiquesDansLeCadre = () => {
    const carte = carteRef.current;
    const L = leafletRef.current;
    if (!carte || !L) return;
    const coinHautGauche = carte.containerPointToLatLng([cadre.x, cadre.y]);
    const coinBasDroit = carte.containerPointToLatLng([cadre.x + cadre.largeur, cadre.y + cadre.hauteur]);
    const zone = L.latLngBounds(coinHautGauche, coinBasDroit);

    const membres = boutiquesAffichees
      .filter((b) => zone.contains(b.position))
      .map((b) => ({ position: b.position, type: "boutique", id: b.id, nom: b.nom, avatarConfig: b.avatar_config }));
    const ici = point(depart?.latitude, depart?.longitude);
    if (ici && zone.contains(ici)) membres.push({ position: ici, type: "ici" });

    if (membres.length === 0) return;
    setModeSelectionActif(false);
    ouvrirListeCluster(zone.getCenter(), membres);
  };

  useEffect(() => {
    let annule = false;
    let carte = null;

    if (estPliee) {
      if (carteRef.current) {
        carteRef.current.remove();
        carteRef.current = null;
      }
      return;
    }

    (async () => {
      if (!conteneur.current || boutiquesAffichees.length === 0) return;
      try {
        const L = (await import("leaflet")).default;
        leafletRef.current = L;
        await import("leaflet/dist/leaflet.css");
        if (annule || !conteneur.current) return;

        if (carteRef.current) {
          carteRef.current.remove();
          carteRef.current = null;
        }

        carte = L.map(conteneur.current, { scrollWheelZoom: true, attributionControl: true });
        carteRef.current = carte;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(carte);

        // Thème sombre façon Explorer — filtre CSS sur le seul pane des
        // tuiles, jamais un sélecteur global (voir FILTRE_TUILES_SOMBRE).
        const paneTuiles = carte.getPane("tilePane");
        if (paneTuiles) paneTuiles.style.filter = FILTRE_TUILES_SOMBRE;

        const points = [];

        // Position de "Vous êtes ici" calculée en amont (utilisée normalement
        // après la boucle plus bas) pour pouvoir déjà l'inclure dans le calcul
        // de chevauchement ci-dessous — évite qu'un point boutique et le point
        // "Vous êtes ici" se superposent silencieusement sans qu'aucun des
        // deux ne réagisse au clic (signalé par l'utilisateur).
        const iciAvance = point(depart?.latitude, depart?.longitude);
        const membresConnus = [
          ...boutiquesAffichees.map((b) => ({ position: b.position, type: "boutique", id: b.id, nom: b.nom, avatarConfig: b.avatar_config })),
          ...(iciAvance ? [{ position: iciAvance, type: "ici" }] : []),
        ];

        // Deux marqueurs peuvent se superposer visuellement à l'écran (même
        // point exact, ou juste très proches à ce niveau de zoom) : un clic
        // dessus n'a alors aucune façon fiable de savoir LEQUEL on visait, et
        // l'un des deux (souvent "Vous êtes ici", ajouté en dernier donc
        // au-dessus) intercepte tous les clics sans rien faire. Plutôt qu'un
        // bouton "loupe" séparé, le premier clic sur un point encombré zoome
        // pour les séparer visuellement (comme Google Maps) ; une fois
        // séparés, le clic déclenche l'action normale. Quand deux points sont
        // RÉELLEMENT à la même coordonnée (fréquent en démo : position de
        // l'utilisateur = position de sa propre boutique), aucun zoom ne les
        // sépare jamais — passé un certain niveau, une petite liste
        // cliquable remplace le zoom pour choisir lequel ouvrir (demande
        // explicite de l'utilisateur : "un outil qui me permette de voir
        // toutes les boutiques qui se trouvent là").
        const SEUIL_CLUSTER_PX = 26;
        function membresEncombres(position) {
          const p1 = carte.latLngToContainerPoint(position);
          return membresConnus.filter((m) => {
            const p2 = carte.latLngToContainerPoint(m.position);
            return Math.hypot(p1.x - p2.x, p1.y - p2.y) < SEUIL_CLUSTER_PX;
          });
        }
        function gererClicPoint(position, actionSiSepare) {
          const zoomActuel = carte.getZoom();
          const membres = membresEncombres(position);
          if (membres.length <= 1) {
            actionSiSepare();
            return;
          }
          // Coordonnées réellement identiques (le zoom max n'a rien séparé) :
          // proposer la liste plutôt que de continuer à zoomer pour rien.
          if (zoomActuel >= 17) {
            ouvrirListeCluster(position, membres);
          } else {
            carte.flyTo(position, Math.min(zoomActuel + 4, 18), { duration: 0.6 });
          }
        }

        // Deux boutiques (pas "Vous êtes ici", déjà géré ci-dessus) à la
        // même position : cliquer sur l'une doit permettre de voir l'autre
        // aussi, pas seulement zoomer/lister. Demande explicite de
        // l'utilisateur : "si je clique là, ça doit les dissocier un peu".
        // marqueursCreesParId retient l'instance Leaflet + la position
        // géographique d'origine de chaque marqueur boutique, remplie au
        // fil de la boucle ci-dessous (le marqueur cliqué existe déjà, ceux
        // pas encore créés seront rattrapés par l'ordre naturel de la
        // boucle vu que le groupe entier est recalculé à chaque clic).
        const marqueursCreesParId = new Map();
        const groupesDissocies = new Set();
        function dissocierGroupeAuClic(b) {
          const membres = membresEncombres(b.position).filter((m) => m.type === "boutique");
          if (membres.length <= 1) return;
          const cle = membres.map((m) => m.id).sort().join("|");
          const dejaDissocie = groupesDissocies.has(cle);
          const rayonPx = 24;
          membres.forEach((m, i) => {
            const entree = marqueursCreesParId.get(m.id);
            if (!entree) return;
            if (dejaDissocie) {
              entree.marqueur.setLatLng(entree.positionOrigine);
            } else {
              const angle = (2 * Math.PI * i) / membres.length - Math.PI / 2;
              const pOrigine = carte.latLngToContainerPoint(entree.positionOrigine);
              const pDecale = L.point(pOrigine.x + rayonPx * Math.cos(angle), pOrigine.y + rayonPx * Math.sin(angle));
              entree.marqueur.setLatLng(carte.containerPointToLatLng(pDecale));
            }
          });
          if (dejaDissocie) groupesDissocies.delete(cle);
          else groupesDissocies.add(cle);
        }

        for (const b of boutiquesAffichees) {
          let couleur = COULEUR;
          if (b.type_boutique === "service") {
            couleur = COULEUR_SERVICE;
          } else if (b.type_boutique === "etablissement") {
            couleur = COULEUR_ETABLISSEMENT;
          } else {
            const enStock = b.articles.some((a) => a.statut === "en_stock");
            couleur = enStock ? COULEUR : "#6b7280";
          }

          // Badge Premium Marketplace (Point 6) — coin opposé au badge de
          // statut d'ouverture ci-dessous pour ne jamais les superposer.
          // Couronne discrète plutôt qu'une bordure d'avatar recolorée :
          // la couleur de bordure porte déjà le type_boutique (produit/
          // service/établissement), la réutiliser pour Premium aurait
          // rendu les deux informations indistinguables.
          const premiumBadgeHtml = b.estPremium
            ? `<div style="position:absolute;top:-3px;left:-3px;background:#F59E0B;color:#000;font-size:8px;padding:1px 3px;border-radius:9999px;border:1.5px solid #fff;line-height:1;box-shadow:0 1px 3px rgba(0,0,0,0.4);z-index:2;">👑</div>`
            : "";

          // Statut d'ouverture en direct — uniquement pour les établissements
          // (demande explicite : ne rien changer pour produit/service). Sans
          // ce filtre, calculerStatutOuverture("indiques" jamais configuré,
          // horaires=[]) renvoie ouvert:null pour TOUTE boutique produit ou
          // service, et le "else" ci-dessous (branche "Fermé") l'affichait
          // par erreur comme fermée sur la carte.
          const st = b.type_boutique === "etablissement" ? calculerStatutOuverture(b, b.horaires) : null;
          let pointStatutHtml = "";
          let alarmeBadgeHtml = "";
          let pointAlarmeBadgeHtml = "";

          // renseigne===false : mode "indiques" jamais configuré — aucun
          // badge plutôt qu'un "Fermé" trompeur (même règle que le badge de
          // l'onglet Domaine, voir calculerStatutOuverture).
          if (st && st.renseigne) {
            if (st.mode === "toujours_ouvert") {
              pointStatutHtml = `<span style="display:inline-block;width:7px;height:7px;border-radius:9999px;background:#10B981;margin-right:4px;box-shadow:0 0 6px #10B981;"></span>`;
              alarmeBadgeHtml = `
                <div style="display:inline-flex;align-items:center;gap:5px;padding:2.5px 8px;border-radius:9999px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.4);margin:2px 0;">
                  <span style="display:inline-block;width:6px;height:6px;border-radius:9999px;background:#10B981;box-shadow:0 0 6px #10B981;"></span>
                  <span style="font-size:9.5px;font-weight:900;color:#34d399;text-transform:uppercase;">Ouvert 24h/24</span>
                </div>`;
              pointAlarmeBadgeHtml = `<div style="position:absolute;bottom:-3px;right:-3px;background:#10B981;color:#000;font-size:7px;font-weight:900;padding:1px 3.5px;border-radius:9999px;border:1.5px solid #fff;line-height:1;box-shadow:0 1px 3px rgba(0,0,0,0.4);z-index:2;">24/7</div>`;
            } else if (st.mode === "sur_rendez_vous") {
              pointStatutHtml = `<span style="display:inline-block;width:7px;height:7px;border-radius:9999px;background:#0284C7;margin-right:4px;box-shadow:0 0 6px #0284C7;"></span>`;
              alarmeBadgeHtml = `
                <div style="display:inline-flex;align-items:center;gap:5px;padding:2.5px 8px;border-radius:9999px;background:rgba(2,132,199,0.15);border:1px solid rgba(2,132,199,0.4);margin:2px 0;">
                  <span style="display:inline-block;width:6px;height:6px;border-radius:9999px;background:#38bdf8;box-shadow:0 0 6px #38bdf8;"></span>
                  <span style="font-size:9.5px;font-weight:900;color:#38bdf8;text-transform:uppercase;">Sur rendez-vous</span>
                </div>`;
              pointAlarmeBadgeHtml = `<div style="position:absolute;bottom:-3px;right:-3px;background:#0284C7;color:#fff;font-size:7px;font-weight:900;padding:1px 3.5px;border-radius:9999px;border:1.5px solid #fff;line-height:1;box-shadow:0 1px 3px rgba(0,0,0,0.4);z-index:2;">RDV</div>`;
            } else if (st.ouvert) {
              pointStatutHtml = `<span style="display:inline-block;width:7px;height:7px;border-radius:9999px;background:#10B981;margin-right:4px;box-shadow:0 0 6px #10B981;"></span>`;
              alarmeBadgeHtml = `
                <div style="display:inline-flex;align-items:center;gap:5px;padding:2.5px 8px;border-radius:9999px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.4);margin:2px 0;">
                  <span style="display:inline-block;width:6px;height:6px;border-radius:9999px;background:#10B981;box-shadow:0 0 6px #10B981;"></span>
                  <span style="font-size:9.5px;font-weight:900;color:#34d399;text-transform:uppercase;">Ouvert</span>
                  <span style="font-size:9px;font-weight:700;color:#6ee7b7;">· ${echapperHtml(st.texteDetail || "")}</span>
                </div>`;
              pointAlarmeBadgeHtml = `<div style="position:absolute;bottom:-3px;right:-3px;background:#10B981;color:#000;font-size:7px;font-weight:900;padding:1px 3.5px;border-radius:9999px;border:1.5px solid #fff;line-height:1;box-shadow:0 1px 3px rgba(0,0,0,0.4);z-index:2;">OUVERT</div>`;
            } else {
              pointStatutHtml = `<span style="display:inline-block;width:7px;height:7px;border-radius:9999px;background:#F43F5E;margin-right:4px;box-shadow:0 0 6px #F43F5E;"></span>`;
              alarmeBadgeHtml = `
                <div style="display:inline-flex;align-items:center;gap:5px;padding:2.5px 8px;border-radius:9999px;background:rgba(244,63,94,0.15);border:1px solid rgba(244,63,94,0.4);margin:2px 0;">
                  <span style="display:inline-block;width:6px;height:6px;border-radius:9999px;background:#fb7185;box-shadow:0 0 6px #fb7185;"></span>
                  <span style="font-size:9.5px;font-weight:900;color:#fda4af;text-transform:uppercase;">Fermé</span>
                  <span style="font-size:9px;font-weight:700;color:#fecdd3;">· ${echapperHtml(st.texteDetail || "")}</span>
                </div>`;
              pointAlarmeBadgeHtml = `<div style="position:absolute;bottom:-3px;right:-3px;background:#F43F5E;color:#fff;font-size:7px;font-weight:900;padding:1px 3.5px;border-radius:9999px;border:1.5px solid #fff;line-height:1;box-shadow:0 1px 3px rgba(0,0,0,0.4);z-index:2;">FERMÉ</div>`;
            }
          }

          const marqueur = b.avatar_config
            ? L.marker(b.position, {
                icon: L.divIcon({
                  className: "carte-boutiques-avatar-icon",
                  html: `
                    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                      <div class="avatar-boutique-zoom-scale" style="position:relative;">
                        <div class="avatar-boutique-anime" style="width:28px;height:28px;border-radius:9999px;border:2.5px solid ${couleur};overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.35);background:#fff;">${svgAvatarBoutique(b.avatar_config, 28)}</div>
                        ${pointAlarmeBadgeHtml}
                        ${premiumBadgeHtml}
                      </div>
                      <span style="display:flex;align-items:center;max-width:96px;padding:1px 6px;background:rgba(17,24,39,0.92);color:#fff;font-size:9px;font-weight:800;border-radius:9999px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 1px 3px rgba(0,0,0,0.3);">${pointStatutHtml}${echapperHtml(b.nom)}</span>
                    </div>
                  `,
                  iconSize: [96, 46],
                  iconAnchor: [48, 14],
                }),
              }).addTo(carte)
            : L.circleMarker(b.position, {
                radius: 9,
                color: couleur,
                weight: 3,
                fillColor: couleur,
                fillOpacity: 0.85,
              }).addTo(carte);

          marqueursCreesParId.set(b.id, { marqueur, positionOrigine: b.position });

          const ligneDetail =
            b.type_boutique === "service"
              ? echapperHtml(b.metier || "Service")
              : b.type_boutique === "etablissement"
              ? echapperHtml(LIBELLES_CATEGORIE_ETABLISSEMENT[b.categorie_etablissement] || "Établissement")
              : `${b.articles.length} article${b.articles.length > 1 ? "s" : ""} · ${distanceLisible(b.distance_km)}`;

          // Aperçu des articles en cartes façon "story" (grande vignette
          // portrait + prix en légende) — permet de voir ce que vend la
          // boutique et son prix directement au survol, pour décider d'aller
          // la visiter, sans avoir à l'ouvrir d'abord. Demande explicite de
          // l'utilisateur (référence : carrousel de story Snapchat/Instagram).
          // N'apparaît que pour les boutiques 'produit' qui ont de vraies
          // photos (service/établissement n'ont jamais d'article, b.articles
          // reste vide pour elles).
          const articlesApercu = (b.articles || []).slice(0, 8);
          const contenuBulle = `
            <div class="bulle-produits-container" style="position:relative; width:220px; max-width:250px; background:#ffffff; border-radius:18px; padding:10px 10px 8px 10px; font-family:inherit; color:#0f172a; box-shadow: 0 16px 36px rgba(0,0,0,0.35);">
              <!-- Bouton Fermer X -->
              <button type="button" class="btn-fermer-bulle" style="position:absolute; top:7px; right:8px; width:20px; height:20px; border-radius:9999px; background:#f1f5f9; border:none; display:flex; align-items:center; justify-content:center; color:#64748b; font-size:11px; font-weight:900; cursor:pointer; z-index:20; line-height:1;" title="Fermer">✕</button>

              <!-- En-tête : Nom boutique + quartier -->
              <div class="btn-ouvrir-boutique-header" style="cursor:pointer; margin-bottom:8px; padding-right:22px;">
                <div style="font-size:12px; font-weight:900; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.2;">${echapperHtml(b.nom || "Boutique")}</div>
                <div style="font-size:9.5px; font-weight:600; color:#64748b; display:flex; align-items:center; gap:3px; margin-top:2px;">
                  <span style="color:#0284c7;">📍</span> <span>${echapperHtml(b.quartier || "Sénégal")}</span>
                  ${b.distance_km ? `<span style="color:#94a3b8;">· ${distanceLisible(b.distance_km)}</span>` : ""}
                </div>
              </div>

              <!-- Carrousel de produits -->
              ${
                articlesApercu.length > 0
                  ? `
                    <div style="display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; padding:2px 1px 4px 1px; -webkit-overflow-scrolling:touch;">
                      ${articlesApercu
                        .map((art) => {
                          const photoUrl = art.photos?.[0] ? urlPhoto(art.photos[0]) : (art.photo ? urlPhoto(art.photo) : (art.image ? urlPhoto(art.image) : ""));
                          const prixTxt = art.prix_xof || art.prix;
                          return `
                            <div data-article-id="${art.id}" style="flex-shrink:0; width:86px; height:112px; border-radius:14px; overflow:hidden; background:#c4a4b8; position:relative; box-shadow:0 3px 10px rgba(0,0,0,0.15); cursor:pointer; transition:transform 0.15s ease;">
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
            offset: [0, -28],
            autoPan: false,
            closeOnClick: false,
          }).setContent(contenuBulle);

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
                  if (typeof onChoisirBoutique === "function") onChoisirBoutique(b.id);
                };
              });
              el.querySelectorAll("[data-article-id]").forEach((card) => {
                card.onclick = (e) => {
                  e.stopPropagation();
                  carte.closePopup(popup);
                  if (typeof onChoisirBoutique === "function") onChoisirBoutique(b.id);
                };
              });
            }, 10);
          };

          const ouvrirBulle = () => {
            if (timerSurvol) clearTimeout(timerSurvol);
            // marqueur.getLatLng() (pas b.position, figé) : après une
            // dissociation, le marqueur a pu être déplacé légèrement, la
            // bulle doit suivre sa position réelle actuelle.
            popup.setLatLng(marqueur.getLatLng()).openOn(carte);
            attacherEcouteursPopup();
          };

          const fermerBulle = () => {
            timerSurvol = setTimeout(() => {
              carte.closePopup(popup);
            }, 300);
          };

          popupsBoutiquesRef.current.set(b.id, {
            ouvrir: ouvrirBulle,
            fermer: fermerBulle,
            boutique: b,
          });

          marqueur.on("mouseover", ouvrirBulle);
          marqueur.on("mouseout", fermerBulle);

          marqueur.on("click", (e) => {
            if (e?.originalEvent) e.originalEvent.stopPropagation();
            dissocierGroupeAuClic(b);
            ouvrirBulle();
            if (typeof onChoisirBoutique === "function") {
              onChoisirBoutique(b.id);
            }
          });
          points.push(b.position);
        }

        // Marqueur "Vous êtes ici" animé (halo + icône), façon Explorer —
        // remplace l'ancien simple point rouge.
        const ici = iciAvance;
        if (ici) {
          // Pane dédié, sous overlayPane (400, cercles vectoriels) ET
          // markerPane (600, marqueurs avatar) : quand la position de
          // l'utilisateur coïncide avec une boutique, "Vous êtes ici" reste
          // visuellement ET pour les événements (survol/clic) EN DESSOUS,
          // quel que soit le type de marqueur boutique (avatar ou cercle —
          // zIndexOffset seul n'aurait aidé que face à un autre marqueur du
          // MÊME pane, jamais face à un cercle SVG d'un pane différent).
          // Sans ça, "Vous êtes ici" interceptait tout, y compris le survol
          // — le clic avait déjà été corrigé (v92) mais pas le survol.
          if (!carte.getPane("paneMoi")) {
            carte.createPane("paneMoi");
            carte.getPane("paneMoi").style.zIndex = 350;
          }
          const iconeMoi = L.divIcon({
            className: "carte-boutiques-moi-icon",
            html: `
              <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
                <div class="animate-ping" style="position:absolute;inset:-6px;background:rgba(56,189,248,0.35);border-radius:9999px;pointer-events:none;"></div>
                <div style="position:relative;width:22px;height:22px;border-radius:9999px;background:linear-gradient(135deg,#38bdf8,#2563eb);border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:11px;">🧑🏾</div>
                <div style="margin-top:2px;padding:1px 6px;background:#2563eb;color:#fff;font-size:8px;font-weight:800;border-radius:9999px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.3);">Vous êtes ici</div>
              </div>
            `,
            iconSize: [70, 50],
            iconAnchor: [35, 25],
          });
          const marqueurMoi = L.marker(ici, { icon: iconeMoi, pane: "paneMoi" }).addTo(carte);
          // Sans ceci, "Vous êtes ici" ne réagissait jamais au clic — et
          // quand il se superposait à une boutique (cas fréquent : la
          // position de démo coïncide avec celle de sa propre boutique), il
          // interceptait le clic sans rien faire du tout à la place.
          marqueurMoi.on("click", () => gererClicPoint(ici, () => carte.flyTo(ici, Math.min(carte.getZoom() + 3, 17), { duration: 0.6 })));
          points.push(ici);
        }

        brancherEchelleZoomAvatars(carte);

        carte.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 15 });

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
  }, [boutiquesAffichees, depart, estPliee]);

  useEffect(() => {
    if (!estPliee && carteRef.current) {
      setTimeout(() => {
        carteRef.current?.invalidateSize();
      }, 250);
    }
  }, [modeCompact, estPliee]);

  const recentrerSurMoi = () => {
    if (carteRef.current && depart) {
      carteRef.current.flyTo([depart.latitude, depart.longitude], 15, { duration: 1 });
    }
  };

  if (boutiques.length === 0 || echec) return null;

  return (
    <div className="mb-2 rounded-2xl sm:rounded-3xl overflow-hidden border border-gray-800/80 bg-[#0B0F17] shadow-xl relative transition-all duration-300">
      {/* CONTENU VISUEL DE LA CARTE (SI NON PLIÉE) */}
      {!estPliee ? (
        <div className="relative w-full overflow-hidden group">
          {/* CARTE LEAFLET EN ARRIÈRE-PLAN COMPLET */}
          <div
            ref={conteneur}
            className={`w-full ${modeCompact ? "h-[160px] sm:h-[190px]" : "h-[210px] sm:h-[270px] md:h-[310px]"} z-0 transition-all duration-300 bg-[#0B0F17]`}
            aria-label="Carte des boutiques proches"
          />

          {/* Cadre de sélection "voir toutes les boutiques d'une zone" —
              déplaçable (glisser le cadre) et redimensionnable (poignée en
              bas à droite), puis validé via le bouton appareil photo. */}
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

          {/* OVERLAY SUPÉRIEUR TRANSPARENT PAR-DESSUS LA CARTE (HUD / Glassmorphism) */}
          <div className="absolute inset-x-0 top-0 z-[400] p-2.5 sm:p-3.5 flex flex-col gap-2 bg-gradient-to-b from-black/85 via-black/40 to-transparent pointer-events-none">
            {/* Ligne 1 : Titre / Menu Déroulant (avec 3 traits ☰) & Actions principales */}
            <div className="flex items-center justify-between gap-2">
              {/* Badge Titre avec 3 traits & Menu Déroulant */}
              <div className="relative pointer-events-auto" ref={menuFiltresRef}>
                <button
                  type="button"
                  onClick={() => setMenuFiltresOuvert(!menuFiltresOuvert)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/15 text-white cursor-pointer shadow-md transition active:scale-95 select-none"
                  title="Ouvrir les filtres de la carte"
                >
                  <i className="fa-solid fa-bars text-xs text-emerald-400"></i>
                  <span className="text-xs sm:text-sm font-black text-white">Carte des boutiques</span>
                  <span className="px-2 py-0.2 rounded-full bg-blue-500/30 text-blue-300 text-[10px] font-black border border-blue-400/20">
                    {boutiques.length}
                  </span>
                  <i className={`fa-solid fa-chevron-down text-[10px] text-gray-300 transition-transform ${menuFiltresOuvert ? "rotate-180" : ""}`}></i>
                </button>

                {/* Menu Déroulant avec tous les filtres */}
                {menuFiltresOuvert && (
                  <div className="absolute left-0 top-full mt-2 w-56 rounded-2xl bg-black/90 backdrop-blur-xl border border-white/20 p-1.5 shadow-2xl z-[500] space-y-1 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-2.5 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Filtres de la carte
                    </div>
                    {PASTILLES_FILTRE.map((p) => {
                      const estActif = filtreActif === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setFiltreActif(p.id);
                            setMenuFiltresOuvert(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition text-left cursor-pointer ${
                            estActif
                              ? "bg-white/20 text-white font-black"
                              : "text-gray-200 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {p.icone ? (
                              <i className={`fa-solid ${p.icone} text-xs ${estActif ? "text-sky-400" : "text-gray-400"}`}></i>
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            )}
                            <span>{p.label}</span>
                          </div>
                          {estActif && <i className="fa-solid fa-check text-emerald-400 text-xs"></i>}
                        </button>
                      );
                    })}

                    <div className="h-px bg-white/10 my-1"></div>

                    {/* Action Autour de moi */}
                    <button
                      type="button"
                      onClick={() => {
                        recentrerSurMoi();
                        setMenuFiltresOuvert(false);
                      }}
                      disabled={!depart}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-emerald-400 hover:bg-white/10 transition text-left cursor-pointer disabled:opacity-40"
                    >
                      <i className="fa-solid fa-location-crosshairs text-xs"></i>
                      <span>Autour de moi</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Boutons d'action droite */}
              <div className="flex items-center gap-1.5 pointer-events-auto">
                {onOuvrirExplorer && (
                  <button
                    type="button"
                    onClick={() => onOuvrirExplorer()}
                    className="w-8 h-8 rounded-full text-sm font-black transition cursor-pointer flex items-center justify-center shadow-md bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/15 text-white active:scale-95 shrink-0"
                    title="Ouvrir la carte Explorer en plein écran"
                  >
                    <span>🌍</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setModeSelectionActif(!modeSelectionActif)}
                  className={`w-8 h-8 rounded-full text-xs font-black transition cursor-pointer flex items-center justify-center shadow-md backdrop-blur-md border active:scale-95 shrink-0 ${
                    modeSelectionActif
                      ? "bg-orange-500 border-orange-300 text-white"
                      : "bg-black/60 hover:bg-black/80 border-white/15 text-white"
                  }`}
                  title="Voir toutes les boutiques d'une zone"
                >
                  <i className="fa-solid fa-magnifying-glass text-xs"></i>
                </button>

                <button
                  type="button"
                  onClick={() => setModeCompact(!modeCompact)}
                  className="w-8 h-8 rounded-full text-xs font-black transition cursor-pointer flex items-center justify-center shadow-md bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/15 text-white active:scale-95 shrink-0"
                  title={modeCompact ? "Agrandir" : "Mode compact"}
                >
                  <span>{modeCompact ? "🔍" : "🤏"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (onReinitialiserPosition) {
                      onReinitialiserPosition();
                    } else {
                      setEstPliee(true);
                    }
                  }}
                  className="w-8 h-8 rounded-full text-sm font-black transition cursor-pointer flex items-center justify-center shadow-md bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/15 text-white active:scale-95 shrink-0"
                  title="Effacer le filtre de position et revenir à tout le catalogue"
                >
                  <i className="fa-solid fa-xmark text-sm text-red-400"></i>
                </button>
              </div>
            </div>
          </div>

          {/* Carrousel d'avatars + légende, en survol de la carte (dégradé
              plutôt qu'un fond opaque) — la carte reste visible en
              arrière-plan au lieu d'être poussée par deux bandes noires
              pleines, demande explicite de l'utilisateur.
              Empreinte verticale réduite au minimum (avatars 24px, paddings
              quasi nuls) : ce bloc est ancré en bas (bottom-0) et grandit
              vers le haut selon son propre contenu — le réduire fait donc
              descendre le carrousel au plus près du bord bas, ce qui dégage
              le maximum d'espace de carte pure au-dessus (les marqueurs,
              dont "Vous êtes ici", s'y superposaient sinon). Une première
              réduction (28px) avait déjà été faite mais jugée insuffisante
              par l'utilisateur — confirmé qu'il veut rester sur ce même
              principe (flottant sur la carte), juste poussé plus loin. */}
          <div className="absolute inset-x-0 bottom-2 z-[400] px-2 flex justify-center pointer-events-none">
            {!modeCompact && boutiquesAffichees.length > 0 && (
              <div className="pointer-events-auto w-full max-w-lg flex items-center justify-center gap-1.5 px-1 select-none">
                {/* Flèche Gauche */}
                <button
                  type="button"
                  onClick={() => {
                    const idxActuel = boutiquesAffichees.findIndex((b) => b.id === (boutiqueActiveId || boutiquesAffichees[0]?.id));
                    const prevIdx = idxActuel > 0 ? idxActuel - 1 : boutiquesAffichees.length - 1;
                    const prevB = boutiquesAffichees[prevIdx];
                    if (prevB) {
                      setBoutiqueActiveId(prevB.id);
                      carteRef.current?.flyTo(prevB.position, 15.5, { duration: 0.8 });
                      const handler = popupsBoutiquesRef.current.get(prevB.id);
                      if (handler?.ouvrir) handler.ouvrir();
                      onChoisirBoutique?.(prevB.id);
                    }
                  }}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/35 hover:bg-black/70 text-white border border-white/25 flex items-center justify-center text-xs backdrop-blur-md shadow-lg active:scale-90 transition cursor-pointer shrink-0 z-30"
                  aria-label="Précédent"
                >
                  <i className="fa-solid fa-chevron-left text-[10px]"></i>
                </button>

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
                  className="flex-1 bg-black/20 hover:bg-black/30 backdrop-blur-md rounded-full py-1.5 px-3 sm:px-5 border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex items-center justify-start sm:justify-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory cursor-grab active:cursor-grabbing touch-pan-x"
                >
                  {boutiquesAffichees.map((b, idx) => {
                    const estSelectionne = boutiqueActiveId ? boutiqueActiveId === b.id : idx === 0;
                    return (
                      <button
                        key={b.id}
                        data-boutique-id={b.id}
                        type="button"
                        onClick={(e) => {
                          if (dragRef.current.hasMoved) return;
                          setBoutiqueActiveId(b.id);
                          carteRef.current?.flyTo(b.position, 15.5, { duration: 0.8 });
                          const handler = popupsBoutiquesRef.current.get(b.id);
                          if (handler?.ouvrir) handler.ouvrir();
                          onChoisirBoutique?.(b.id);
                          e.currentTarget.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
                        }}
                        onMouseEnter={() => {
                          const handler = popupsBoutiquesRef.current.get(b.id);
                          if (handler?.ouvrir) handler.ouvrir();
                        }}
                        onMouseLeave={() => {
                          const handler = popupsBoutiquesRef.current.get(b.id);
                          if (handler?.fermer) handler.fermer();
                        }}
                        className="flex flex-col items-center shrink-0 cursor-pointer group snap-center transition-all duration-300 focus:outline-none"
                      >
                        <div
                          className={`relative rounded-full transition-all duration-300 flex items-center justify-center ${
                            estSelectionne
                              ? "w-12 h-12 sm:w-13 sm:h-13 p-[3px] bg-white shadow-[0_0_20px_rgba(255,255,255,0.85),0_6px_18px_rgba(0,0,0,0.7)] ring-2 ring-black/40 scale-105 z-10"
                              : "w-11 h-11 sm:w-12 sm:h-12 p-[1.5px] bg-white/25 opacity-90 hover:opacity-100 hover:scale-105 shadow-sm"
                          }`}
                        >
                          <div className="w-full h-full rounded-full overflow-hidden bg-gray-900 flex items-center justify-center border border-gray-950">
                            {b.avatar_config ? (
                              <img
                                src={dataUriAvatarBoutique(b.avatar_config, 48)}
                                alt={b.nom}
                                className="w-full h-full object-cover pointer-events-none"
                              />
                            ) : (
                              <span className="text-white text-[9px] font-black pointer-events-none">
                                {b.nom ? b.nom.substring(0, 2).toUpperCase() : "BT"}
                              </span>
                            )}
                          </div>
                          {b.estPremium && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 text-gray-950 flex items-center justify-center text-[7px] font-black border border-white shadow-xs">
                              👑
                            </span>
                          )}
                        </div>
                        {estSelectionne && (
                          <span className="mt-1 px-2 py-0.2 bg-white text-gray-950 text-[9px] font-black rounded-full shadow-md max-w-[70px] truncate border border-gray-200 transition-all duration-200">
                            {b.nom}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Flèche Droite */}
                <button
                  type="button"
                  onClick={() => {
                    const idxActuel = boutiquesAffichees.findIndex((b) => b.id === (boutiqueActiveId || boutiquesAffichees[0]?.id));
                    const nextIdx = idxActuel < boutiquesAffichees.length - 1 ? idxActuel + 1 : 0;
                    const nextB = boutiquesAffichees[nextIdx];
                    if (nextB) {
                      setBoutiqueActiveId(nextB.id);
                      carteRef.current?.flyTo(nextB.position, 15.5, { duration: 0.8 });
                      const handler = popupsBoutiquesRef.current.get(nextB.id);
                      if (handler?.ouvrir) handler.ouvrir();
                      onChoisirBoutique?.(nextB.id);
                    }
                  }}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/35 hover:bg-black/70 text-white border border-white/25 flex items-center justify-center text-xs backdrop-blur-md shadow-lg active:scale-90 transition cursor-pointer shrink-0 z-30"
                  aria-label="Suivant"
                >
                  <i className="fa-solid fa-chevron-right text-[10px]"></i>
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Message d'état quand la carte est pliée */
        <div
          onClick={() => setEstPliee(false)}
          className="px-4 py-3 bg-gray-900/60 hover:bg-gray-900 text-xs text-gray-300 flex items-center justify-between cursor-pointer transition"
        >
          <div className="flex items-center gap-2 font-medium">
            <span className="text-blue-400 font-bold">🗺️ Carte repliée</span>
            <span>· Cliquez sur « Déplier » ou ici pour visualiser les {boutiques.length} boutiques</span>
          </div>
          <span className="text-emerald-400 font-extrabold text-xs flex items-center gap-1">
            <span>Déplier</span>
            <svg className="w-3.5 h-3.5 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
            </svg>
          </span>
        </div>
      )}
    </div>
  );
}
