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

export default function CarteBoutiques({ articles, boutiquesSansArticles = [], depart, onChoisirBoutique, onOuvrirExplorer, onReinitialiserPosition }) {
  const conteneur = useRef(null);
  const carteRef = useRef(null);
  const menuFiltresRef = useRef(null);
  const [echec, setEchec] = useState(false);

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
              pleines, demande explicite de l'utilisateur. */}
          <div className="absolute inset-x-0 bottom-0 z-[400] pt-6 bg-gradient-to-t from-black/75 via-black/40 to-transparent pointer-events-none">
            {!modeCompact && boutiquesAffichees.length > 0 && (
              <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar px-3 pb-1.5 pointer-events-auto">
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

            <div className="px-3.5 sm:px-4 pb-1.5 pt-1 text-[11px] text-gray-200 flex flex-wrap items-center justify-between gap-2 pointer-events-auto">
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
