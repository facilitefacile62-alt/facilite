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
import { useEffect, useMemo, useRef, useState } from "react";
import { echapperHtml } from "@/lib/marketplaceData";
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

export default function CarteBoutiques({ articles, boutiquesSansArticles = [], depart, onChoisirBoutique }) {
  const conteneur = useRef(null);
  const carteRef = useRef(null);
  const [echec, setEchec] = useState(false);

  // États de contrôle : Pliée / Dépliée et Mode Gain d'espace (Compact)
  const [estPliee, setEstPliee] = useState(false);
  const [modeCompact, setModeCompact] = useState(false);
  // Filtre façon Explorer : 'tous' | 'populaires' | 'live'. Contrairement à
  // Explorer, "Autour de moi" n'est pas un filtre mais une action (recentrer
  // sur `depart`, déjà connu ici — pas besoin de re-géolocaliser).
  const [filtreActif, setFiltreActif] = useState("tous");

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
          type_boutique: "produit",
          avatar_config: a.boutique_avatar_config || null,
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
        avatar_config: s.avatar_config || null,
        articles: [],
      });
    }
    return [...par.values()];
  }, [articles, boutiquesSansArticles]);

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
        await import("leaflet/dist/leaflet.css");
        if (annule || !conteneur.current) return;

        // Bug confirmé (mesure directe : conteneur à 0px de haut malgré des
        // tuiles chargées avec succès) : `boutiques`/`depart` changent à
        // chaque nouvelle recherche (nouvelle référence de tableau via
        // useMemo), donc cet effet se rejoue souvent — sans ce nettoyage,
        // L.map() était appelé une seconde fois sur le même élément DOM
        // avant que le nettoyage de l'exécution précédente n'ait eu lieu,
        // ce que Leaflet gère mal (état interne corrompu, hauteur effondrée).
        if (carteRef.current) {
          carteRef.current.remove();
          carteRef.current = null;
        }

        carte = L.map(conteneur.current, { scrollWheelZoom: false, attributionControl: true });
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

        for (const b of boutiquesAffichees) {
          // Couleur par type : produit garde le bleu historique (avec le
          // gris "hors stock" existant), service/établissement ont leur
          // propre couleur fixe — "en stock" n'a pas de sens pour eux (zéro
          // article par construction, pas par rupture).
          let couleur = COULEUR;
          if (b.type_boutique === "service") {
            couleur = COULEUR_SERVICE;
          } else if (b.type_boutique === "etablissement") {
            couleur = COULEUR_ETABLISSEMENT;
          } else {
            const enStock = b.articles.some((a) => a.statut === "en_stock");
            couleur = enStock ? COULEUR : "#6b7280";
          }

          // Avatar façon Bitmoji en priorité si le vendeur en a configuré un
          // (SVG DiceBear généré en local, inliné directement dans le HTML du
          // divIcon — aucune URL externe) ; sinon le point coloré habituel.
          // Le nom est affiché en permanence sous l'avatar (pas seulement au
          // survol via bindTooltip, invisible par défaut) — sur mobile,
          // personne ne "survole" un pin. Deux wrappers imbriqués autour du
          // cercle avatar : .avatar-boutique-zoom-scale (le JS y pose
          // `transform: scale()` sur zoomend) et .avatar-boutique-anime, son
          // enfant, qui porte la respiration CSS — jamais le même élément
          // pour les deux, sinon l'un écrase le `transform` de l'autre. La
          // position lat/lng du marqueur n'est jamais touchée, seul ce
          // sous-élément visuel bouge.
          const marqueur = b.avatar_config
            ? L.marker(b.position, {
                icon: L.divIcon({
                  className: "carte-boutiques-avatar-icon",
                  html: `
                    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                      <div class="avatar-boutique-zoom-scale">
                        <div class="avatar-boutique-anime" style="width:28px;height:28px;border-radius:9999px;border:2.5px solid ${couleur};overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.35);background:#fff;">${svgAvatarBoutique(b.avatar_config, 28)}</div>
                      </div>
                      <span style="max-width:84px;padding:1px 6px;background:rgba(17,24,39,0.92);color:#fff;font-size:9px;font-weight:800;border-radius:9999px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 1px 3px rgba(0,0,0,0.3);">${echapperHtml(b.nom)}</span>
                    </div>
                  `,
                  iconSize: [90, 46],
                  iconAnchor: [45, 14],
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

          const lignes = [
            `<strong>${echapperHtml(b.nom)}</strong>`,
            b.quartier ? echapperHtml(b.quartier) : null,
            ligneDetail,
          ].filter(Boolean);
          marqueur.bindTooltip(lignes.join("<br>"));

          if (typeof onChoisirBoutique === "function") {
            marqueur.on("click", () => onChoisirBoutique(b.id));
          }
          points.push(b.position);
        }

        // Marqueur "Vous êtes ici" animé (halo + icône), façon Explorer —
        // remplace l'ancien simple point rouge.
        const ici = point(depart?.latitude, depart?.longitude);
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
          L.marker(ici, { icon: iconeMoi }).addTo(carte);
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
    <div className="mb-4 rounded-2xl sm:rounded-3xl overflow-hidden border border-gray-800 bg-[#0B0F17] shadow-sm transition-all duration-300">

      {/* 1. BARRE DE CONTRÔLE SUPÉRIEURE AVEC FLÈCHE ET BOUTONS VISIBLES */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 sm:px-4 py-2.5 bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 border-b border-gray-800 select-none">

        {/* Titre avec indicateur de position */}
        <div
          onClick={() => setEstPliee(!estPliee)}
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition"
          title={estPliee ? "Cliquez pour déplier la carte" : "Cliquez pour plier la carte"}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-gray-100">
            <span>Carte des boutiques</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-950/60 text-blue-400 text-[11px] font-bold">
              {boutiques.length}
            </span>
          </div>
        </div>

        {/* Boutons d'Action : 1. Gagner de l'espace (Compact) | 2. Flèche Plier/Déplier */}
        <div className="flex items-center gap-2 ml-auto">

          {/* BOUTON 1 : GAGNER DE L'ESPACE (Mode Compact) */}
          {!estPliee && (
            <button
              type="button"
              onClick={() => setModeCompact(!modeCompact)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs border active:scale-95 ${
                modeCompact
                  ? "bg-[#1877F2] text-white border-[#1877F2] ring-2 ring-blue-400/30"
                  : "bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700"
              }`}
              title={modeCompact ? "Agrandir la carte à la taille normale" : "Explorer la carte en plus grand"}
            >
              <svg
                className={`w-3.5 h-3.5 ${modeCompact ? "text-white" : "text-[#1877F2]"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {modeCompact ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 4v4H5m0 0l4-4M15 4v4h4m0 0l-4-4M9 20v-4H5m0 0l4 4M15 20v-4h4m0 0l-4 4" />
                )}
              </svg>
              <span className="font-extrabold">
                {modeCompact ? "Agrandir" : "Explorer"}
              </span>
            </button>
          )}

          {/* BOUTON 2 : FLÈCHE POUR PLIER / DÉPLIER LA CARTE */}
          <button
            type="button"
            onClick={() => setEstPliee(!estPliee)}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs border active:scale-95 ${
              estPliee
                ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                : "bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700"
            }`}
            title={estPliee ? "Déplier et afficher la carte" : "Plier et masquer la carte pour voir directement les articles"}
          >
            {/* Flèche SVG très nette */}
            <svg
              className={`w-4 h-4 transition-transform duration-300 ${
                estPliee ? "rotate-180 text-white" : "rotate-0 text-gray-300"
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
            </svg>
            <span>{estPliee ? "Déplier la carte" : "Plier la carte"}</span>
          </button>
        </div>
      </div>

      {/* 2. CONTENU VISUEL DE LA CARTE (SI NON PLIÉE) */}
      {!estPliee ? (
        <div className="animate-in fade-in duration-200 relative group">

          {/* Pastilles de filtre façon Explorer — masquées en mode compact,
              pas la place pour elles dans une hauteur réduite. */}
          {!modeCompact && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-3 py-2 bg-gray-950/80 border-b border-gray-800">
              {PASTILLES_FILTRE.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setFiltreActif(p.id)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    filtreActif === p.id
                      ? "bg-white text-gray-950"
                      : "bg-gray-800/90 text-gray-200 hover:bg-gray-700 border border-gray-700/80"
                  }`}
                >
                  {p.icone ? (
                    <i className={`fa-solid ${p.icone} text-[10px] ${filtreActif === p.id ? "text-sky-500" : "text-sky-400"}`}></i>
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
                  )}
                  <span>{p.label}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={recentrerSurMoi}
                disabled={!depart}
                className="px-3 py-1.5 rounded-full text-[11px] font-extrabold whitespace-nowrap bg-gray-800/90 hover:bg-gray-700 text-gray-200 border border-gray-700/80 transition cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-40"
              >
                <i className="fa-solid fa-location-crosshairs text-[10px] text-emerald-400"></i>
                <span>Autour de moi</span>
              </button>
            </div>
          )}

          {/* Boutons flottants d'accès rapide directement sur la carte */}
          <div className="absolute top-2.5 right-2.5 z-[400] flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              onClick={() => setModeCompact(!modeCompact)}
              className="px-2.5 py-1 rounded-lg bg-gray-900/90 hover:bg-gray-800 text-gray-100 text-[10px] font-black shadow-md backdrop-blur-xs border border-gray-700 flex items-center gap-1 cursor-pointer transition active:scale-95"
              title={modeCompact ? "Agrandir" : "Réduire"}
            >
              <span>{modeCompact ? "🔍 Agrandir" : "🤏 Compact"}</span>
            </button>
            <button
              type="button"
              onClick={() => setEstPliee(true)}
              className="w-7 h-7 rounded-lg bg-gray-900/90 hover:bg-gray-800 text-gray-100 shadow-md backdrop-blur-xs border border-gray-700 flex items-center justify-center cursor-pointer transition active:scale-95"
              title="Plier la carte"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>

          <div
            ref={conteneur}
            className={`w-full ${modeCompact ? "h-[135px] sm:h-[155px]" : "h-[280px] sm:h-[380px]"} z-0 transition-all duration-300 bg-[#0B0F17]`}
            aria-label="Carte des boutiques proches"
          />

          {/* Carrousel d'avatars façon dock Explorer — masqué en mode compact. */}
          {!modeCompact && boutiquesAffichees.length > 0 && (
            <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar px-3 py-2.5 bg-gray-950/80 border-t border-gray-800">
              {boutiquesAffichees.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    carteRef.current?.flyTo(b.position, 15, { duration: 1 });
                    onChoisirBoutique?.(b.id);
                  }}
                  className="flex flex-col items-center gap-1 shrink-0 p-1 rounded-xl hover:bg-gray-800/80 transition cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-gray-700 bg-gray-800 flex items-center justify-center">
                    {b.avatar_config ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={dataUriAvatarBoutique(b.avatar_config, 36)}
                        alt={b.nom}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-white text-[10px] font-black">
                        {b.nom ? b.nom.substring(0, 2).toUpperCase() : "BT"}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] font-bold text-gray-300 max-w-[52px] truncate">{b.nom}</span>
                </button>
              ))}
            </div>
          )}

          <div className="px-3.5 sm:px-4 py-1.5 text-[11px] text-gray-400 flex flex-wrap items-center justify-between gap-2 border-t border-gray-800 bg-gray-950/60">
            <span>
              {boutiquesAffichees.length} boutique{boutiquesAffichees.length > 1 ? "s" : ""} dans le rayon choisi. Touchez un marqueur pour voir le détail.
            </span>
            {modeCompact && (
              <span className="text-blue-400 font-bold text-[10px]">
                ✓ Mode gain d&apos;espace actif
              </span>
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
