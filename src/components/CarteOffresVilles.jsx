"use client";

// Carte « Autour de moi » de Facilité : une pastille à compteur par ville où des
// entreprises recrutent (voir src/lib/offresParVille.js).
//
// Elle reprend le fonctionnement de la carte de Locaux (CarteBoutiques) :
//  * même cadre sombre et mêmes tuiles assombries (filtre CSS sur le seul pane
//    des tuiles) ;
//  * bandeau flottant en haut : menu ☰ avec les filtres et l'action
//    « Autour de moi », bouton mode compact, bouton « effacer » ;
//  * marqueur « Vous êtes ici » animé ;
//  * dock en bas : carrousel des villes (pastille + compteur) avec flèches ;
//    toucher une ville la centre sur la carte et ouvre sa bulle ;
//  * bulle sombre au clic sur une pastille (entreprises et postes) ;
//  * déclutter par zoom : une petite pastille trop proche d'une plus grosse
//    est masquée (elle reste dans le dock), plus on zoome plus elles reviennent.
// Mêmes contraintes que les autres cartes du site : Leaflet importé
// dynamiquement, aucun marqueur PNG par défaut (bloqué par la CSP) — divIcon
// uniquement —, molette désactivée tant que la carte n'a pas le focus.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { echapperHtml } from "@/lib/marketplaceData";

const BLEU = "#2563EB";
const ORANGE = "#F59E0B";
const FILTRE_TUILES_SOMBRE = "invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9)";
const DISTANCE_MIN_PX = 44;

const PASTILLES_FILTRE = [
  { id: "toutes", label: "Toutes les villes", icone: "fa-compass" },
  { id: "actives", label: "Les plus actives", icone: "fa-trophy" },
];

function detruire(carte) {
  if (!carte) return;
  try {
    carte.stop();
    carte._animatingZoom = false;
    carte.remove();
  } catch (err) {
    console.warn("Destruction de la carte Leaflet ignorée :", err?.message);
  }
}

export default function CarteOffresVilles({ groupes, selection, onSelect, position, onLocaliser }) {
  const conteneur = useRef(null);
  const carteRef = useRef(null);
  const leafletRef = useRef(null);
  const couchesRef = useRef(null);
  const dockRef = useRef(null);
  const menuRef = useRef(null);
  const dejaAjustee = useRef(false);
  const marqueursRef = useRef(new Map());
  const [prete, setPrete] = useState(0);
  const [zoom, setZoom] = useState(7);
  const [filtre, setFiltre] = useState("toutes");
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [compact, setCompact] = useState(false);

  const affichees = useMemo(() => (filtre === "actives" ? groupes.slice(0, Math.max(3, Math.ceil(groupes.length / 2))) : groupes), [groupes, filtre]);

  // Création de la carte (une seule fois).
  useEffect(() => {
    let annule = false;
    let observateur = null;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (annule || !conteneur.current || carteRef.current) return;
      leafletRef.current = L;
      const carte = L.map(conteneur.current, { zoomControl: false, scrollWheelZoom: false, attributionControl: true }).setView([14.5, -15.5], 7);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(carte);
      const paneTuiles = carte.getPane("tilePane");
      if (paneTuiles) paneTuiles.style.filter = FILTRE_TUILES_SOMBRE;
      L.control.zoom({ position: "bottomright" }).addTo(carte);
      couchesRef.current = L.layerGroup().addTo(carte);
      carteRef.current = carte;
      carte.on("focus", () => carte.scrollWheelZoom.enable());
      carte.on("blur", () => carte.scrollWheelZoom.disable());
      carte.on("zoomend", () => setZoom(carte.getZoom()));
      // Le cadre change de taille (chargement, mode compact, rotation de l'écran) :
      // sans ceci des bandes de tuiles restent vides.
      observateur = new ResizeObserver(() => carte.invalidateSize());
      observateur.observe(conteneur.current);
      setZoom(carte.getZoom());
      setPrete((n) => n + 1);
    })();
    return () => {
      annule = true;
      observateur?.disconnect();
      detruire(carteRef.current);
      carteRef.current = null;
      couchesRef.current = null;
      dejaAjustee.current = false;
    };
  }, []);

  // Ferme le menu des filtres au clic en dehors.
  useEffect(() => {
    if (!menuOuvert) return undefined;
    const dehors = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOuvert(false);
    };
    document.addEventListener("mousedown", dehors);
    document.addEventListener("touchstart", dehors);
    return () => {
      document.removeEventListener("mousedown", dehors);
      document.removeEventListener("touchstart", dehors);
    };
  }, [menuOuvert]);

  const ouvrirBulle = useCallback((g) => {
    const L = leafletRef.current;
    const carte = carteRef.current;
    if (!L || !carte) return;
    const lignes = g.offres
      .slice(0, 4)
      .map(
        (o) =>
          `<a href="/offres/${encodeURIComponent(o.id)}" style="display:block;text-decoration:none;color:#fff;padding:3px 0;border-top:1px solid rgba(255,255,255,.12)"><span style="display:block;font-size:10px;font-weight:900;color:#93c5fd">${echapperHtml(o.entreprise)}</span><span style="display:block;font-size:11px;font-weight:700;max-width:220px">${echapperHtml(o.titre)}</span></a>`
      )
      .join("");
    const reste = g.offres.length - 4;
    const html = `<div style="min-width:180px"><div style="font-size:12px;font-weight:900;margin-bottom:4px">${echapperHtml(g.ville)} · ${g.offres.length} offre${g.offres.length > 1 ? "s" : ""}</div>${lignes}${reste > 0 ? `<div style="font-size:10px;font-weight:800;color:#6ee7b7;margin-top:4px">+ ${reste} autre${reste > 1 ? "s" : ""} dans la liste sous la carte</div>` : ""}</div>`;
    L.popup({ className: "carte-boutique-bulle-custom", closeButton: true, offset: [0, -14], autoPanPaddingTopLeft: [20, 70], autoPanPaddingBottomRight: [20, 80] }).setLatLng([g.lat, g.lng]).setContent(html).openOn(carte);
  }, []);

  const choisir = useCallback(
    (g, { voler = true } = {}) => {
      onSelect(g.ville);
      const carte = carteRef.current;
      if (carte && voler) carte.flyTo([g.lat, g.lng], Math.max(carte.getZoom(), 9), { duration: 0.7 });
      ouvrirBulle(g);
    },
    [onSelect, ouvrirBulle]
  );

  // Pastilles : redessinées quand les données, le zoom ou la sélection changent.
  useEffect(() => {
    const L = leafletRef.current;
    const carte = carteRef.current;
    const couches = couchesRef.current;
    if (!L || !carte || !couches) return;
    couches.clearLayers();
    marqueursRef.current = new Map();

    // Déclutter : on garde en priorité les villes les plus actives (déjà triées),
    // et la ville sélectionnée est toujours affichée.
    const retenues = [];
    const ordre = [...affichees].sort((a, b) => (b.ville === selection) - (a.ville === selection));
    for (const g of ordre) {
      const pt = carte.project([g.lat, g.lng], carte.getZoom());
      const gene = g.ville !== selection && retenues.some((r) => Math.hypot(r.pt.x - pt.x, r.pt.y - pt.y) < DISTANCE_MIN_PX);
      if (!gene) retenues.push({ g, pt });
    }

    const points = [];
    for (const { g } of retenues) {
      const n = g.offres.length;
      const taille = n >= 50 ? 58 : n >= 10 ? 50 : 42;
      const couleur = selection === g.ville ? ORANGE : BLEU;
      const icone = L.divIcon({
        className: "bulle-offres-ville",
        html: `<div style="width:${taille}px;height:${taille}px;border-radius:9999px;background:${couleur};color:#fff;border:3px solid #fff;box-shadow:0 0 0 6px ${couleur}33,0 6px 16px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font:800 ${taille > 45 ? 18 : 16}px system-ui,sans-serif;cursor:pointer">${n}</div>`,
        iconSize: [taille, taille],
        iconAnchor: [taille / 2, taille / 2],
      });
      const marqueur = L.marker([g.lat, g.lng], { icon: icone, keyboard: false, title: `${g.ville} : ${n} offre${n > 1 ? "s" : ""}` }).addTo(couches);
      marqueur.bindTooltip(g.ville, { permanent: true, direction: "bottom", offset: [0, taille / 2 - 4], className: "carte-boutique-bulle-custom" });
      marqueur.on("click", () => choisir(g, { voler: false }));
      marqueursRef.current.set(g.ville, marqueur);
    }
    for (const g of affichees) points.push([g.lat, g.lng]);

    if (position) {
      if (!carte.getPane("paneMoi")) {
        carte.createPane("paneMoi");
        carte.getPane("paneMoi").style.zIndex = 350;
      }
      const iconeMoi = L.divIcon({
        className: "carte-boutiques-moi-icon",
        html: `<div style="position:relative;display:flex;flex-direction:column;align-items:center;"><div class="animate-ping" style="position:absolute;inset:-6px;background:rgba(56,189,248,0.35);border-radius:9999px;pointer-events:none;"></div><div style="position:relative;width:22px;height:22px;border-radius:9999px;background:linear-gradient(135deg,#38bdf8,#2563eb);border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:11px;">🧑🏾</div><div style="margin-top:2px;padding:1px 6px;background:#2563eb;color:#fff;font-size:8px;font-weight:800;border-radius:9999px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.3);">Vous êtes ici</div></div>`,
        iconSize: [70, 50],
        iconAnchor: [35, 25],
      });
      L.marker([position.lat, position.lng], { icon: iconeMoi, pane: "paneMoi", keyboard: false }).addTo(couches);
    }

    if (!dejaAjustee.current && points.length > 0) {
      dejaAjustee.current = true;
      if (points.length === 1) carte.setView(points[0], 10);
      else carte.fitBounds(points, { padding: [40, 80], maxZoom: 9 });
    }
  }, [affichees, selection, position, zoom, prete, choisir]);

  // Le dock suit la sélection.
  useEffect(() => {
    if (!dockRef.current || !selection) return;
    const el = dockRef.current.querySelector(`[data-ville="${CSS.escape(selection)}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [selection]);

  const voisine = (sens) => {
    if (affichees.length === 0) return;
    const i = affichees.findIndex((g) => g.ville === selection);
    const suivant = affichees[(i + sens + affichees.length) % affichees.length];
    choisir(suivant);
  };

  const recentrerSurMoi = () => {
    if (position && carteRef.current) carteRef.current.flyTo([position.lat, position.lng], 11, { duration: 1 });
    else onLocaliser?.();
  };

  const effacer = () => {
    onSelect(null);
    carteRef.current?.closePopup();
    if (carteRef.current && affichees.length > 0) {
      carteRef.current.fitBounds(affichees.map((g) => [g.lat, g.lng]), { padding: [40, 80], maxZoom: 9 });
    }
  };

  const bouton = "w-8 h-8 rounded-full text-xs font-black transition cursor-pointer flex items-center justify-center shadow-md bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/15 text-white active:scale-95 shrink-0";

  return (
    <div className={`relative w-full ${compact ? "h-[200px] sm:h-[230px]" : "h-[420px] sm:h-[480px]"} transition-all duration-300 rounded-2xl sm:rounded-3xl overflow-hidden border border-gray-800/80 bg-[#0B0F17] shadow-xl`}>
      <div ref={conteneur} className="w-full h-full z-0 bg-[#0B0F17]" role="region" aria-label="Carte des villes où des entreprises recrutent" />

      {/* Bandeau flottant du haut */}
      <div className="absolute inset-x-0 top-0 z-[400] p-2.5 sm:p-3.5 flex items-center justify-between gap-2 bg-gradient-to-b from-black/85 via-black/40 to-transparent pointer-events-none">
        <div className="relative pointer-events-auto" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOuvert(!menuOuvert)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/15 text-white cursor-pointer shadow-md transition active:scale-95 select-none"
            title="Ouvrir les filtres de la carte"
          >
            <i className="fa-solid fa-bars text-xs text-emerald-400"></i>
            <span className="text-xs sm:text-sm font-black text-white">Carte des offres</span>
            <span className="px-2 rounded-full bg-blue-500/30 text-blue-300 text-[10px] font-black border border-blue-400/20">{groupes.length}</span>
            <i className={`fa-solid fa-chevron-down text-[10px] text-gray-300 transition-transform ${menuOuvert ? "rotate-180" : ""}`}></i>
          </button>
          {menuOuvert ? (
            <div className="absolute left-0 top-full mt-2 w-56 rounded-2xl bg-black/90 backdrop-blur-xl border border-white/20 p-1.5 shadow-2xl z-[500] space-y-1">
              <div className="px-2.5 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Filtres de la carte</div>
              {PASTILLES_FILTRE.map((p) => {
                const actif = filtre === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setFiltre(p.id);
                      setMenuOuvert(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition text-left cursor-pointer ${actif ? "bg-white/20 text-white font-black" : "text-gray-200 hover:bg-white/10 hover:text-white"}`}
                  >
                    <span className="flex items-center gap-2">
                      <i className={`fa-solid ${p.icone} text-xs ${actif ? "text-sky-400" : "text-gray-400"}`}></i>
                      {p.label}
                    </span>
                    {actif ? <i className="fa-solid fa-check text-emerald-400 text-xs"></i> : null}
                  </button>
                );
              })}
              <div className="h-px bg-white/10 my-1"></div>
              <button
                type="button"
                onClick={() => {
                  recentrerSurMoi();
                  setMenuOuvert(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-emerald-400 hover:bg-white/10 transition text-left cursor-pointer"
              >
                <i className="fa-solid fa-location-crosshairs text-xs"></i>
                <span>Autour de moi</span>
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button type="button" onClick={() => setCompact(!compact)} className={bouton} title={compact ? "Agrandir" : "Mode compact"}>
            <span>{compact ? "🔍" : "🤏"}</span>
          </button>
          <button type="button" onClick={effacer} className={bouton} title="Effacer la sélection et revoir toutes les villes">
            <i className="fa-solid fa-xmark text-sm text-red-400"></i>
          </button>
        </div>
      </div>

      {/* Dock : carrousel des villes */}
      {!compact && affichees.length > 0 ? (
        <div className="absolute inset-x-0 bottom-2 z-[400] px-2 flex justify-center pointer-events-none">
          <div className="pointer-events-auto w-full max-w-md flex items-center justify-center gap-1 px-1 select-none">
            <button type="button" onClick={() => voisine(-1)} className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center justify-center backdrop-blur-md shadow-lg active:scale-90 transition cursor-pointer shrink-0" aria-label="Ville précédente">
              <i className="fa-solid fa-chevron-left text-[10px]"></i>
            </button>
            <div ref={dockRef} className="flex-1 bg-white/10 backdrop-blur-md rounded-full py-1 px-2 flex items-center gap-2 overflow-x-auto overscroll-x-contain no-scrollbar scroll-smooth">
              {affichees.map((g) => {
                const actif = selection === g.ville;
                return (
                  <button
                    key={g.ville}
                    type="button"
                    data-ville={g.ville}
                    onClick={() => choisir(g)}
                    className="flex flex-col items-center gap-0.5 shrink-0 w-14 cursor-pointer"
                    title={`${g.ville} : ${g.offres.length} offre${g.offres.length > 1 ? "s" : ""}`}
                  >
                    <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-white border-2 ${actif ? "bg-amber-500 border-white scale-110" : "bg-blue-600 border-white/70"} transition`}>
                      {g.offres.length}
                    </span>
                    <span className={`text-[9px] font-extrabold truncate w-full text-center ${actif ? "text-amber-300" : "text-white"}`}>{g.ville}</span>
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={() => voisine(1)} className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center justify-center backdrop-blur-md shadow-lg active:scale-90 transition cursor-pointer shrink-0" aria-label="Ville suivante">
              <i className="fa-solid fa-chevron-right text-[10px]"></i>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
