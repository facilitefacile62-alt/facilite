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
  const [echec, setEchec] = useState(false);

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
              // La position exacte du membre, pas le centre du groupe/cadre
              // (potentiellement plus large que quelques mètres avec l'outil
              // de sélection) — plus précis pour recentrer la carte.
              carte.flyTo(m.position, Math.min(carte.getZoom() + 3, 17), { duration: 0.6 });
            } else if (typeof onChoisirBoutique === "function") {
              onChoisirBoutique(m.id);
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
          const articlesApercu = b.articles.filter((a) => a.photos?.[0]).slice(0, 5);
          const vignettesHtml = articlesApercu.length
            ? `<div style="display:flex;gap:6px;margin-bottom:8px;overflow-x:auto;max-width:220px;">
                ${articlesApercu
                  .map(
                    (a) => `
                  <div style="flex-shrink:0;width:56px;">
                    <div style="width:56px;height:74px;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.4);">
                      <img src="${urlPhoto(a.photos[0])}" style="width:100%;height:100%;object-fit:cover;display:block;" />
                    </div>
                    ${
                      a.prix_xof
                        ? `<div style="font-size:8px;font-weight:900;color:#34d399;margin-top:3px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Number(a.prix_xof).toLocaleString("fr-FR")} F</div>`
                        : ""
                    }
                  </div>`
                  )
                  .join("")}
              </div>`
            : "";

          const contenuBulle = `
            <div style="min-width:140px;padding:2px 0;color:#fff;font-family:inherit;">
              ${vignettesHtml}
              <div style="font-size:12px;font-weight:900;color:#ffffff;line-height:1.2;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${echapperHtml(b.nom)}</div>
              ${alarmeBadgeHtml}
              <div style="display:flex;flex-direction:column;gap:2px;margin-top:4px;font-size:10px;">
                ${b.quartier ? `<span style="color:#94a3b8;display:flex;align-items:center;gap:3px;"><span style="color:#38bdf8;">📍</span> ${echapperHtml(b.quartier)}</span>` : ""}
                <span style="color:#cbd5e1;font-weight:700;display:flex;align-items:center;gap:3px;"><span style="color:#f59e0b;">📦</span> ${ligneDetail}</span>
              </div>
            </div>
          `;

          marqueur.bindTooltip(contenuBulle, {
            direction: "top",
            opacity: 1,
            className: "carte-boutique-bulle-custom",
            offset: [0, -10]
          });
          marqueur.bindPopup(contenuBulle, {
            closeButton: false,
            className: "carte-boutique-bulle-custom",
            offset: [0, -10]
          });

          if (typeof onChoisirBoutique === "function") {
            marqueur.on("click", () => gererClicPoint(b.position, () => onChoisirBoutique(b.id)));
          }
          points.push(b.position);
        }

        // Marqueur "Vous êtes ici" animé (halo + icône), façon Explorer —
        // remplace l'ancien simple point rouge.
        const ici = iciAvance;
        if (ici) {
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
          const marqueurMoi = L.marker(ici, { icon: iconeMoi }).addTo(carte);
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
          <div className="absolute inset-x-0 bottom-0 z-[400] pt-6 bg-gradient-to-t from-black/75 via-black/40 to-transparent pointer-events-none">
            {!modeCompact && boutiquesAffichees.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-3 pb-0.5 pointer-events-auto">
                {boutiquesAffichees.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      carteRef.current?.flyTo(b.position, 15, { duration: 1 });
                      onChoisirBoutique?.(b.id);
                    }}
                    className="flex flex-col items-center gap-0 shrink-0 rounded-xl hover:bg-gray-800/80 transition cursor-pointer"
                  >
                    <div
                      className={`w-6 h-6 rounded-full overflow-hidden border-2 bg-gray-800 flex items-center justify-center ${
                        b.estPremium ? "border-amber-400" : "border-gray-700"
                      }`}
                    >
                      {b.avatar_config ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={dataUriAvatarBoutique(b.avatar_config, 24)}
                          alt={b.nom}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-white text-[8px] font-black">
                          {b.nom ? b.nom.substring(0, 2).toUpperCase() : "BT"}
                        </span>
                      )}
                    </div>
                    <span className="text-[8px] font-bold text-gray-300 max-w-[52px] truncate leading-tight">
                      {b.estPremium && <span className="text-amber-400">★ </span>}
                      {b.nom}
                    </span>
                  </button>
                ))}
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
