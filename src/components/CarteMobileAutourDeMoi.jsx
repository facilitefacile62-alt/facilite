"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { urlPhoto, normaliserWhatsapp } from "@/lib/marketplaceData";

const distanceLisible = (km) =>
  km == null || !Number.isFinite(Number(km))
    ? ""
    : Number(km) < 1
      ? `${Math.round(Number(km) * 1000)} m`
      : `${String(Number(km)).replace(".", ",")} km`;

const prixLisible = (v) => new Intl.NumberFormat("fr-FR").format(Number(v) || 0);

function point(lat, lng) {
  const a = lat === null || lat === undefined || lat === "" ? null : Number(lat);
  const b = lng === null || lng === undefined || lng === "" ? null : Number(lng);
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  return [a, b];
}

// Calcule l'heure d'arrivée estimée (ex: "15:30")
function calculerHeureArrivee(minutes = 4) {
  const now = new Date();
  now.setMinutes(now.getMinutes() + minutes);
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export default function CarteMobileAutourDeMoi({
  articles = [],
  depart = null,
  onVoirArticle,
  onVoirBoutique,
  onFermerProximite,
}) {
  const conteneurRef = useRef(null);
  const carteRef = useRef(null);
  const polylineRef = useRef(null);
  const marqueursRef = useRef([]);

  // Onglet sélectionné dans le panneau inférieur : 'produits' ou 'vendeurs'
  const [ongletVue, setOngletVue] = useState("produits"); // 'produits' | 'vendeurs'
  const [pageIndex, setPageIndex] = useState(0); // Pagination par groupe de 4
  const [articleActifId, setArticleActifId] = useState(null);
  const [boutiqueActiveId, setBoutiqueActiveId] = useState(null);
  const [carteChargee, setCarteChargee] = useState(false);

  // Regroupement des boutiques uniques avec leurs articles associés
  const boutiques = useMemo(() => {
    const map = new Map();
    for (const a of articles) {
      const p = point(a.boutique_lat, a.boutique_lng);
      if (!p) continue;
      const id = a.boutique_id || `${p[0]},${p[1]}`;
      if (!map.has(id)) {
        map.set(id, {
          id,
          nom: a.boutique_nom || "Boutique Partenaire",
          quartier: a.quartier || "Dakar",
          ville: a.ville || "Dakar",
          distance_km: a.distance_km,
          position: p,
          telephone_whatsapp: a.telephone_whatsapp,
          whatsappUrl: a.whatsappUrl,
          articles: [],
        });
      }
      map.get(id).articles.push(a);
    }
    return [...map.values()];
  }, [articles]);

  // Initialisation de la sélection par défaut (premier article ou première
  // boutique) — setState différé : corps de l'effet, pas un callback d'un
  // système externe, exigé par la règle react-hooks correspondante.
  useEffect(() => {
    queueMicrotask(() => {
      if (articles.length > 0 && !articleActifId) {
        setArticleActifId(articles[0].id);
      }
      if (boutiques.length > 0 && !boutiqueActiveId) {
        setBoutiqueActiveId(boutiques[0].id);
      }
    });
  }, [articles, boutiques, articleActifId, boutiqueActiveId]);

  // Élément actuellement sélectionné
  const articleActif = useMemo(
    () => articles.find((a) => a.id === articleActifId) || articles[0] || null,
    [articles, articleActifId]
  );

  const boutiqueActive = useMemo(
    () => boutiques.find((b) => b.id === boutiqueActiveId) || boutiques[0] || null,
    [boutiques, boutiqueActiveId]
  );

  // Cible courante selon l'onglet
  const cibleCourante = useMemo(() => {
    if (ongletVue === "produits" && articleActif) {
      const pos = point(articleActif.boutique_lat, articleActif.boutique_lng);
      const km = articleActif.distance_km || 1.2;
      const min = Math.max(3, Math.round(km * 3));
      return {
        titre: articleActif.titre,
        nomVendeur: articleActif.boutique_nom || "facilite shop",
        quartier: articleActif.quartier || articleActif.ville || "Pikine / Dakar",
        position: pos || (depart ? [depart.latitude + 0.008, depart.longitude + 0.012] : [14.75, -17.39]),
        distanceKm: km,
        dureeMin: min,
        heureArrivee: calculerHeureArrivee(min),
        prix: articleActif.prix_xof,
        whatsappUrl: articleActif.whatsappUrl,
        raw: articleActif,
      };
    }
    if (boutiqueActive) {
      const km = boutiqueActive.distance_km || 1.5;
      const min = Math.max(4, Math.round(km * 3));
      return {
        titre: boutiqueActive.nom,
        nomVendeur: boutiqueActive.nom,
        quartier: boutiqueActive.quartier || boutiqueActive.ville || "Dakar",
        position: boutiqueActive.position || (depart ? [depart.latitude + 0.008, depart.longitude + 0.012] : [14.75, -17.39]),
        distanceKm: km,
        dureeMin: min,
        heureArrivee: calculerHeureArrivee(min),
        articlesCount: boutiqueActive.articles.length,
        whatsappUrl: boutiqueActive.whatsappUrl,
        raw: boutiqueActive,
      };
    }
    return {
      titre: "Boutique à proximité",
      nomVendeur: "facilite shop",
      quartier: "Parcelles Assainies",
      position: depart ? [depart.latitude + 0.008, depart.longitude + 0.012] : [14.75, -17.39],
      distanceKm: 1.2,
      dureeMin: 4,
      heureArrivee: calculerHeureArrivee(4),
      whatsappUrl: null,
    };
  }, [ongletVue, articleActif, boutiqueActive, depart]);

  // Découpage en groupe de 4 cases exactement
  const LISTE_AFFICHEE_4 = useMemo(() => {
    const source = ongletVue === "produits" ? articles : boutiques;
    const start = pageIndex * 4;
    return source.slice(start, start + 4);
  }, [ongletVue, articles, boutiques, pageIndex]);

  const totalPages = Math.ceil((ongletVue === "produits" ? articles.length : boutiques.length) / 4);

  // Initialisation et mise à jour de la carte Leaflet
  useEffect(() => {
    let annule = false;

    (async () => {
      if (!conteneurRef.current) return;
      try {
        const L = (await import("leaflet")).default;
        await import("leaflet/dist/leaflet.css");
        if (annule || !conteneurRef.current) return;

        if (!carteRef.current) {
          const startCenter = depart
            ? [depart.latitude, depart.longitude]
            : [14.745, -17.40];

          const map = L.map(conteneurRef.current, {
            zoomControl: false,
            scrollWheelZoom: true,
            attributionControl: false,
          }).setView(startCenter, 13);

          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
          }).addTo(map);

          carteRef.current = map;
          setCarteChargee(true);
        }

        const map = carteRef.current;

        // Nettoyage des anciens marqueurs & polylines
        marqueursRef.current.forEach((m) => m.remove());
        marqueursRef.current = [];
        if (polylineRef.current) {
          polylineRef.current.remove();
          polylineRef.current = null;
        }

        const points = [];

        // 1. Marqueur Départ / Utilisateur (Point vert / rouge pulsant style Yango)
        const userPos = depart ? [depart.latitude, depart.longitude] : [14.754, -17.43];
        points.push(userPos);

        const userIcon = L.divIcon({
          className: "custom-user-marker",
          html: `
            <div style="position: relative; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;">
              <div style="position: absolute; inset: 0; background: rgba(37, 99, 235, 0.25); border-radius: 9999px; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              <div style="width: 14px; height: 14px; background: #2563EB; border: 3px solid #FFFFFF; border-radius: 9999px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);"></div>
            </div>
          `,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });

        const mUser = L.marker(userPos, { icon: userIcon }).addTo(map);
        mUser.bindTooltip("Votre position", { permanent: false });
        marqueursRef.current.push(mUser);

        // 2. Marqueur Destination / Boutique Active
        const destPos = cibleCourante.position;
        if (destPos) {
          points.push(destPos);

          const destIcon = L.divIcon({
            className: "custom-dest-marker",
            html: `
              <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
                <div style="background: #EF4444; color: white; padding: 2px 7px; border-radius: 8px; font-weight: 900; font-size: 11px; box-shadow: 0 4px 8px rgba(239, 68, 68, 0.4); display: flex; align-items: center; gap: 3px;">
                  <span>${cibleCourante.dureeMin || 4}</span>
                  <span style="font-size: 8px;">MIN</span>
                </div>
                <div style="width: 2px; height: 6px; background: #EF4444;"></div>
                <div style="width: 10px; height: 10px; background: #EF4444; border: 2px solid white; border-radius: 9999px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>
              </div>
            `,
            iconSize: [44, 38],
            iconAnchor: [22, 38],
          });

          const mDest = L.marker(destPos, { icon: destIcon }).addTo(map);
          mDest.bindTooltip(`<strong>${cibleCourante.nomVendeur}</strong><br/>${cibleCourante.quartier}`, {
            permanent: false,
          });
          marqueursRef.current.push(mDest);

          // 3. Tracé d'itinéraire multi-segments cinématique (Vert -> Orange -> Vert comme Yango)
          const mid1 = [
            userPos[0] + (destPos[0] - userPos[0]) * 0.33 + 0.0015,
            userPos[1] + (destPos[1] - userPos[1]) * 0.33 - 0.001,
          ];
          const mid2 = [
            userPos[0] + (destPos[0] - userPos[0]) * 0.66 - 0.001,
            userPos[1] + (destPos[1] - userPos[1]) * 0.66 + 0.0015,
          ];

          const routeCoords = [userPos, mid1, mid2, destPos];

          // Tracé de fond blanc pour contraste élevé
          const borderLine = L.polyline(routeCoords, {
            color: "#FFFFFF",
            weight: 8,
            opacity: 0.9,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(map);

          // Tracé vert fluide de navigation
          const mainLine = L.polyline(routeCoords, {
            color: "#10B981",
            weight: 5,
            opacity: 0.95,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(map);

          // Segment orange / trafic intermédiaire
          const trafficLine = L.polyline([mid1, mid2], {
            color: "#F59E0B",
            weight: 5,
            opacity: 0.95,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(map);

          polylineRef.current = L.featureGroup([borderLine, mainLine, trafficLine]);
        }

        // 4. Autres boutiques environnantes (petits points)
        for (const b of boutiques) {
          if (b.position && (!destPos || b.position[0] !== destPos[0] || b.position[1] !== destPos[1])) {
            points.push(b.position);
            const otherIcon = L.divIcon({
              className: "custom-small-store",
              html: `
                <div style="width: 14px; height: 14px; background: #1E293B; border: 2px solid white; border-radius: 9999px; box-shadow: 0 2px 4px rgba(0,0,0,0.25);"></div>
              `,
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            });
            const mOther = L.marker(b.position, { icon: otherIcon }).addTo(map);
            mOther.on("click", () => {
              setBoutiqueActiveId(b.id);
              if (b.articles[0]) setArticleActifId(b.articles[0].id);
            });
            marqueursRef.current.push(mOther);
          }
        }

        if (points.length > 0) {
          map.fitBounds(L.latLngBounds(points), {
            paddingTopLeft: [40, 40],
            paddingBottomRight: [40, 40],
            maxZoom: 15,
          });
        }

        setTimeout(() => {
          if (!annule && carteRef.current) carteRef.current.invalidateSize();
        }, 150);
      } catch (err) {
        console.error("Erreur d'affichage Leaflet Mobile:", err);
      }
    })();

    return () => {
      annule = true;
    };
  }, [cibleCourante, boutiques, depart]);

  // Empêche le défilement de la page derrière la vue plein écran — sans ça,
  // le geste de scroll sur le panneau du bas fait aussi défiler la page
  // Marketplace en arrière-plan. Verrouillé sur <html> ET <body> : un seul
  // des deux ne suffit pas sur tous les navigateurs, et un ascenseur de
  // navigateur visible sur le bord droit était pris à tort pour un bouton
  // de l'app par un utilisateur (signalé en capture) — il doit disparaître
  // complètement, pas juste être neutralisé côté body.
  useEffect(() => {
    const html = document.documentElement;
    const { body } = document;
    const overflowHtmlOriginal = html.style.overflow;
    const overflowBodyOriginal = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = overflowHtmlOriginal;
      body.style.overflow = overflowBodyOriginal;
    };
  }, []);

  // Recentre la carte
  const recentrerCarte = () => {
    if (carteRef.current && cibleCourante?.position) {
      carteRef.current.setView(cibleCourante.position, 14, { animate: true });
    }
  };

  return (
    // Plein écran véritable (fixed inset-0), pas une carte de hauteur fixe
    // intégrée à la page : demande explicite de l'utilisateur en comparant
    // avec une capture d'une app de VTC (carte qui occupe tout l'écran du
    // téléphone, panneau du bas par-dessus). z-[600] : au-dessus de l'en-tête
    // (z-50) et du tiroir de menu mobile (z-[99999] réservé au menu lui-même,
    // qu'on ne peut pas ouvrir en même temps que cette vue de toute façon).
    <div className="fixed inset-0 z-[600] bg-gray-50 dark:bg-zinc-950 flex flex-col overflow-hidden">
      {/* ========================================================================= */}
      {/* 1. CARTE INTERACTIVE PLEIN ÉCRAN STYLE YANGO / TAXI (1:1 Capture 1)       */}
      {/* ========================================================================= */}
      <div className="relative flex-1 min-h-0 w-full bg-slate-200 dark:bg-zinc-900 overflow-hidden select-none">
        {/* Conteneur Leaflet */}
        <div ref={conteneurRef} className="w-full h-full z-0" />

        {/* Bouton Retour en haut à gauche */}
        <button
          type="button"
          onClick={onFermerProximite}
          className="absolute top-3 left-3 z-[400] w-9 h-9 rounded-full bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 shadow-lg flex items-center justify-center cursor-pointer border border-gray-200/80 dark:border-zinc-700 active:scale-90 transition"
          title="Fermer la vue autour de moi"
        >
          <i className="fa-solid fa-arrow-left text-sm"></i>
        </button>

        {/* Badge Heure d'Arrivée (Haut Gauche - Style 1:1 Capture 1) */}
        <div className="absolute top-3.5 left-14 z-[400] px-3 py-1.5 rounded-full bg-white/95 dark:bg-zinc-900/95 text-zinc-900 dark:text-white text-[11px] font-black shadow-md backdrop-blur-xs border border-gray-200/80 dark:border-zinc-700 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-black dark:bg-white"></span>
          <span>arrivée à {cibleCourante.heureArrivee}</span>
        </div>

        {/* Badge ETA Rouge Fluo (Haut Droite - Style 1:1 Capture 1) */}
        <div className="absolute top-3 right-14 z-[400] px-3 py-1.5 rounded-2xl bg-[#FF3B30] text-white text-center shadow-lg shadow-red-500/30 flex flex-col items-center leading-none">
          <span className="text-xs font-black">{cibleCourante.dureeMin || 4}</span>
          <span className="text-[8px] font-bold uppercase tracking-wider">min</span>
        </div>

        {/* Bouton Itinéraire / Tracé (Haut Droite) */}
        <button
          type="button"
          onClick={recentrerCarte}
          className="absolute top-3 right-3 z-[400] w-9 h-9 rounded-full bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 shadow-lg flex items-center justify-center cursor-pointer border border-gray-200/80 dark:border-zinc-700 active:scale-90 transition"
          title="Recentrer sur la boutique"
        >
          <i className="fa-solid fa-route text-sm text-[#2563EB]"></i>
        </button>

        {/* Badge Route en Bas à Droite ("Via les routes à péage / directes") */}
        <div className="absolute bottom-3 right-3 z-[400] px-3 py-1.5 rounded-xl bg-white/95 dark:bg-zinc-900/95 text-zinc-800 dark:text-zinc-200 text-[10px] font-extrabold shadow-md backdrop-blur-xs border border-gray-200/80 dark:border-zinc-700 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Via vendeurs directs · {distanceLisible(cibleCourante.distanceKm)}</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. PANNEAU INFÉRIEUR / BOTTOM SHEET (Inspiré de la Capture 1 & 2)         */}
      {/* Hauteur plafonnée + défilement propre : la carte au-dessus (flex-1)     */}
      {/* doit rester visible, comme sur la capture de référence, plutôt que le    */}
      {/* panneau ne prenne tout l'écran.                                          */}
      {/* ========================================================================= */}
      <div className="shrink-0 max-h-[58vh] overflow-y-auto no-scrollbar bg-white dark:bg-zinc-900 px-4 pt-2.5 pb-4 rounded-t-3xl -mt-4 relative z-10 shadow-2xl border-t border-gray-100 dark:border-zinc-800">
        {/* Poignée de tiroir / Drag handle */}
        <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mb-3"></div>

        {/* A. Lignes d'adresse Départ / Destination (1:1 Capture 1) */}
        <div className="space-y-2 mb-3 pb-3 border-b border-gray-100 dark:border-zinc-800">
          {/* Ligne 1 : Départ / Ma position */}
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-person-walking text-xs text-zinc-700 dark:text-zinc-300"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">
                {depart ? `Ma position actuelle (GPS actif)` : `Rue PE-37, 237 · Dakar`}
              </p>
            </div>
          </div>

          {/* Ligne 2 : Destination / Boutique choisie avec badge "Arrêts" */}
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-flag-checkered text-xs text-red-600 dark:text-red-400"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-zinc-950 dark:text-white truncate">
                {cibleCourante.quartier} · {cibleCourante.dureeMin} min
              </p>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-bold shrink-0">
              {cibleCourante.nomVendeur}
            </span>
          </div>
        </div>

        {/* B. Onglets sélecteurs de mode : 'Produits' ou 'Vendeurs' (Style pilules Capture 1) */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setOngletVue("produits");
                setPageIndex(0);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                ongletVue === "produits"
                  ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 shadow-sm"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white"
              }`}
            >
              <i className="fa-solid fa-box-open text-[10px]"></i>
              <span>Produits ({articles.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOngletVue("vendeurs");
                setPageIndex(0);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                ongletVue === "vendeurs"
                  ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 shadow-sm"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white"
              }`}
            >
              <i className="fa-solid fa-store text-[10px]"></i>
              <span>Vendeurs ({boutiques.length})</span>
            </button>
          </div>

          {/* Navigation pagination si > 4 items */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-500">
              <span>{pageIndex + 1}/{totalPages}</span>
              <button
                type="button"
                onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                disabled={pageIndex === 0}
                className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center disabled:opacity-30 cursor-pointer"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                disabled={pageIndex >= totalPages - 1}
                className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center disabled:opacity-30 cursor-pointer"
              >
                ›
              </button>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* C. LES 4 CASES EXACTES (PRODUITS OU VENDEURS SELON L'ONGLET SÉLECTIONNÉ)   */}
        {/* ========================================================================= */}
        {ongletVue === "produits" ? (
          /* GRILLE DE 4 PRODUITS (2x2 ou 4 cases avec photos, LIVE, prix et actions) */
          <div className="grid grid-cols-2 gap-2.5 mb-3.5">
            {LISTE_AFFICHEE_4.map((art) => {
              const estActif = articleActifId === art.id;
              const photo = art.photos?.[0] || null;

              return (
                <div
                  key={art.id}
                  onClick={() => {
                    setArticleActifId(art.id);
                    onVoirArticle?.(art);
                  }}
                  className={`group relative rounded-2xl overflow-hidden bg-zinc-50 dark:bg-zinc-800/80 border transition-all duration-200 cursor-pointer p-2 flex flex-col justify-between ${
                    estActif
                      ? "border-[#FF3B30] dark:border-[#FF3B30] ring-2 ring-red-500/20 shadow-md bg-red-50/10"
                      : "border-gray-200 dark:border-zinc-700 hover:border-zinc-400"
                  }`}
                >
                  {/* Image carrée avec badges overlay */}
                  <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-zinc-200 dark:bg-zinc-700 mb-1.5">
                    {photo ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={urlPhoto(photo)}
                        alt={art.titre}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-400">
                        <i className="fa-solid fa-bag-shopping text-2xl"></i>
                      </div>
                    )}

                    {/* Vendeur & Check */}
                    <div className="absolute top-1 left-1 z-10 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[9px] text-white font-bold max-w-[80%] truncate">
                      <span className="truncate">{art.boutique_nom || "facilite"}</span>
                      <i className="fa-solid fa-circle-check text-sky-400 text-[8px]"></i>
                    </div>

                    {/* Badge LIVE */}
                    <span className="absolute top-1 right-1 z-10 px-1 py-0.5 rounded bg-red-600 text-white text-[8px] font-black uppercase tracking-wider flex items-center gap-0.5">
                      <span className="w-1 h-1 rounded-full bg-white animate-pulse"></span>
                      LIVE
                    </span>

                    {/* Badge Distance / Quartier en bas */}
                    <span className="absolute bottom-1 left-1 z-10 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-xs text-white text-[8px] font-bold flex items-center gap-1">
                      <i className="fa-solid fa-location-dot text-emerald-400 text-[7px]"></i>
                      <span>{art.quartier || "Dakar"}</span>
                    </span>
                  </div>

                  {/* Infos Produit : Titre & Prix */}
                  <div className="flex-1 flex flex-col justify-between">
                    <h4 className="text-[11px] font-extrabold text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-tight">
                      {art.titre}
                    </h4>

                    <div className="flex items-end justify-between mt-1.5 pt-1 border-t border-gray-200/50 dark:border-zinc-700/50">
                      <div>
                        <p className="text-[9px] text-zinc-500 dark:text-zinc-400 truncate">
                          {art.boutique_nom || "Vendeur"}
                        </p>
                        <p className="text-xs font-black text-zinc-950 dark:text-white">
                          {prixLisible(art.prix_xof)}{" "}
                          <span className="text-[9px] font-bold text-zinc-500">FCFA</span>
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onVoirArticle?.(art);
                        }}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] transition ${
                          estActif
                            ? "bg-[#FF3B30] text-white shadow-sm"
                            : "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
                        }`}
                        title="Voir la fiche"
                      >
                        <i className="fa-solid fa-arrow-right"></i>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* GRILLE DE 4 VENDEURS / BOUTIQUES */
          <div className="grid grid-cols-2 gap-2.5 mb-3.5">
            {LISTE_AFFICHEE_4.map((b) => {
              const estActif = boutiqueActiveId === b.id;
              const nbArticles = b.articles.length;

              return (
                <div
                  key={b.id}
                  onClick={() => {
                    setBoutiqueActiveId(b.id);
                    if (b.articles[0]) setArticleActifId(b.articles[0].id);
                    onVoirBoutique?.(b);
                  }}
                  className={`group relative rounded-2xl overflow-hidden bg-zinc-50 dark:bg-zinc-800/80 border transition-all duration-200 cursor-pointer p-2.5 flex flex-col justify-between ${
                    estActif
                      ? "border-[#FF3B30] dark:border-[#FF3B30] ring-2 ring-red-500/20 shadow-md bg-red-50/10"
                      : "border-gray-200 dark:border-zinc-700 hover:border-zinc-400"
                  }`}
                >
                  <div>
                    {/* Avatar & En-tête */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                        {b.nom ? b.nom.substring(0, 2).toUpperCase() : "BT"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <h4 className="text-xs font-black text-zinc-900 dark:text-white truncate">
                            {b.nom}
                          </h4>
                          <i className="fa-solid fa-circle-check text-sky-400 text-[9px] shrink-0"></i>
                        </div>
                        <span className="text-[9px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1 truncate">
                          <i className="fa-solid fa-location-dot text-red-500 text-[8px]"></i>
                          {b.quartier}
                        </span>
                      </div>
                    </div>

                    {/* Badge Disponibilité & Stock */}
                    <div className="bg-white dark:bg-zinc-900 rounded-xl p-1.5 border border-gray-100 dark:border-zinc-800 mb-2">
                      <p className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        {nbArticles} article{nbArticles > 1 ? "s" : ""} dispo
                      </p>
                      <p className="text-[9px] text-zinc-400 mt-0.5">
                        Distance : {distanceLisible(b.distance_km || 1.2)}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onVoirBoutique?.(b);
                    }}
                    className="w-full py-1.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[10px] font-black text-center transition hover:opacity-90 cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span>Visiter boutique</span>
                    <i className="fa-solid fa-chevron-right text-[8px]"></i>
                  </button>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
