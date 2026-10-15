"use client";

// Suivi en direct d'une livraison Marketplace, côté acheteur — en grand, sur une
// carte au même thème que celle de Locaux (cadre sombre, tuiles assombries,
// bandeau flottant), et non plus dans une petite fenêtre.
//
// La position du livreur est diffusée via Supabase Realtime sur
// marketplace_commandes (policy RLS déjà restreinte à l'acheteur/livreur/
// vendeur/admin de la ligne — un tiers abonné au même canal ne reçoit rien,
// l'isolement est structurel, pas applicatif). La carte montre : le point du
// livreur (animé), le trajet qu'il a déjà fait, la boutique de retrait, et le
// lieu de livraison quand il est connu (commande rejointe à un groupage). Même
// contraintes que les autres cartes du site : Leaflet importé dynamiquement avec
// son CSS, aucun marqueur PNG par défaut (bloqué par la CSP) — des divIcon.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { confirmerReceptionCommande } from "@/lib/marketplaceData";

const LIBELLES_STATUT = {
  en_attente_livreur: "En attente d'un livreur",
  assignee: "Un livreur est en route vers le vendeur",
  recuperee: "Le livreur a récupéré votre colis",
  en_livraison: "Le livreur est en route vers vous",
  livree_declaree: "Livré — en attente de votre confirmation",
  livree: "Livré",
  annulee: "Commande annulée",
};

const FILTRE_TUILES_SOMBRE = "invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9)";

const pastille = (couleur, contenu, pulse = false) =>
  `<div style="position:relative;display:flex;align-items:center;justify-content:center">${
    pulse ? `<div class="animate-ping" style="position:absolute;inset:-8px;background:${couleur}55;border-radius:9999px;pointer-events:none"></div>` : ""
  }<div style="position:relative;width:34px;height:34px;border-radius:9999px;background:${couleur};color:#fff;border:3px solid #fff;box-shadow:0 3px 12px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-size:15px">${contenu}</div></div>`;

function distanceKm(a, b) {
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export default function SuiviLivraisonModal({ commande, onFermer, onConfirme }) {
  const conteneur = useRef(null);
  const carteRef = useRef(null);
  const leafletRef = useRef(null);
  const couchesRef = useRef(null);
  const traceRef = useRef([]);
  const [commandeLive, setCommandeLive] = useState(commande);
  const [boutique, setBoutique] = useState(null);
  const [prete, setPrete] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    const channel = supabase
      .channel(`suivi-commande-${commande.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "marketplace_commandes", filter: `id=eq.${commande.id}` },
        (payload) => setCommandeLive((prev) => ({ ...prev, ...payload.new }))
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [commande.id]);

  // Boutique de retrait (point vert) : lecture publique de ses coordonnées.
  useEffect(() => {
    if (!commande.store_id) return undefined;
    let annule = false;
    supabase
      .from("marketplace_stores")
      .select("nom, latitude, longitude")
      .eq("id", commande.store_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!annule && data && data.latitude != null && data.longitude != null) setBoutique(data);
      });
    return () => {
      annule = true;
    };
  }, [commande.store_id]);

  // Carte créée une seule fois. Le conteneur reste TOUJOURS visible (une carte
  // créée dans un élément masqué a une taille nulle et n'affiche aucune tuile),
  // et se redessine à chaque changement de taille.
  useEffect(() => {
    let annule = false;
    let observateur = null;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (annule || !conteneur.current || carteRef.current) return;
      leafletRef.current = L;
      const carte = L.map(conteneur.current, { zoomControl: false, scrollWheelZoom: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(carte);
      const paneTuiles = carte.getPane("tilePane");
      if (paneTuiles) paneTuiles.style.filter = FILTRE_TUILES_SOMBRE;
      L.control.zoom({ position: "bottomright" }).addTo(carte);
      carte.setView([14.72, -17.35], 12);
      couchesRef.current = L.layerGroup().addTo(carte);
      carteRef.current = carte;
      observateur = new ResizeObserver(() => carte.invalidateSize());
      observateur.observe(conteneur.current);
      setPrete(true);
    })();
    return () => {
      annule = true;
      observateur?.disconnect();
      if (carteRef.current) {
        try {
          carteRef.current.stop();
          carteRef.current._animatingZoom = false;
          carteRef.current.remove();
        } catch (err) {
          console.warn("Destruction de la carte Leaflet ignorée :", err?.message);
        }
        carteRef.current = null;
        couchesRef.current = null;
      }
    };
  }, []);

  const lat = commandeLive.livreur_position_lat;
  const lng = commandeLive.livreur_position_lng;
  const destLat = commandeLive.livraison_lat;
  const destLng = commandeLive.livraison_lng;

  // Dessin : à chaque position reçue on ajoute un point au trajet parcouru et on
  // redessine ; la carte suit le livreur sans dézoomer sur ce qu'on regarde.
  useEffect(() => {
    const L = leafletRef.current;
    const carte = carteRef.current;
    const couches = couchesRef.current;
    if (!prete || !L || !carte || !couches) return;
    couches.clearLayers();
    const points = [];
    if (boutique) {
      L.marker([boutique.latitude, boutique.longitude], { icon: L.divIcon({ className: "", html: pastille("#10B981", "🏪"), iconSize: [34, 34], iconAnchor: [17, 17] }), keyboard: false, title: boutique.nom || "Boutique" }).addTo(couches);
      points.push([boutique.latitude, boutique.longitude]);
    }
    if (destLat != null && destLng != null) {
      L.marker([destLat, destLng], { icon: L.divIcon({ className: "", html: pastille("#EF4444", "📍"), iconSize: [34, 34], iconAnchor: [17, 17] }), keyboard: false, title: "Votre livraison" }).addTo(couches);
      points.push([destLat, destLng]);
    }
    if (lat != null && lng != null) {
      const dernier = traceRef.current[traceRef.current.length - 1];
      if (!dernier || dernier[0] !== lat || dernier[1] !== lng) traceRef.current.push([lat, lng]);
      if (traceRef.current.length > 1) L.polyline(traceRef.current, { color: "#38bdf8", weight: 5, opacity: 0.9 }).addTo(couches);
      L.marker([lat, lng], { icon: L.divIcon({ className: "", html: pastille("#2563EB", "🛵", true), iconSize: [34, 34], iconAnchor: [17, 17] }), keyboard: false, title: "Livreur", zIndexOffset: 1000 }).addTo(couches);
      points.push([lat, lng]);
    }
    if (points.length === 1) carte.setView(points[0], 15, { animate: true });
    else if (points.length > 1) carte.fitBounds(points, { padding: [70, 70], maxZoom: 16, animate: true });
  }, [prete, boutique, lat, lng, destLat, destLng]);

  const confirmer = async () => {
    setConfirmation(true);
    setErreur("");
    try {
      await confirmerReceptionCommande(commande.id);
      onConfirme?.();
      onFermer?.();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setConfirmation(false);
    }
  };

  const aPosition = lat != null && lng != null;
  const restant = aPosition && destLat != null && destLng != null ? distanceKm({ lat, lng }, { lat: destLat, lng: destLng }) : null;
  const libelleDistance = restant == null ? null : restant < 1 ? `${Math.round(restant * 1000)} m` : `${restant.toFixed(1).replace(".", ",")} km`;

  return createPortal(
    // stopPropagation : la fenêtre est rendue dans un portail, mais React fait quand même remonter les clics
    // jusqu'à « Mes commandes » (son parent dans l'arbre React), dont le fond se ferme au clic — ce qui
    // refermait aussi le suivi à chaque appui sur la carte.
    <div className="fixed inset-0 z-[80] bg-[#0B0F17]" role="dialog" aria-label="Suivi de livraison" onClick={(e) => e.stopPropagation()}>
      <div ref={conteneur} className="absolute inset-0 z-0" aria-label="Carte du suivi de livraison" />

      {/* Bandeau flottant du haut */}
      <div className="absolute inset-x-0 top-0 z-[400] p-3 sm:p-4 flex items-start justify-between gap-3 bg-gradient-to-b from-black/85 via-black/45 to-transparent pointer-events-none">
        <div className="pointer-events-auto min-w-0 max-w-[80%] rounded-2xl bg-black/65 backdrop-blur-md border border-white/15 px-4 py-2.5">
          <p className="text-[10px] font-black uppercase tracking-wider text-sky-300">Suivi de livraison</p>
          <p className="text-sm font-black text-white truncate">{commande.item?.titre || "Votre commande"}</p>
          <p className="text-xs font-bold text-gray-200">{LIBELLES_STATUT[commandeLive.statut] || commandeLive.statut}</p>
          {!aPosition && commandeLive.statut === "en_livraison" && (
            <p className="text-[11px] text-gray-300 mt-0.5">En attente de la position du livreur…</p>
          )}
          {libelleDistance && commandeLive.statut === "en_livraison" && (
            <p className="text-xs font-black text-emerald-300 mt-0.5">
              <i className="fa-solid fa-route mr-1"></i>À {libelleDistance} de chez vous
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onFermer}
          className="pointer-events-auto w-10 h-10 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-md border border-white/20 text-white flex items-center justify-center cursor-pointer shrink-0"
          aria-label="Fermer"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      {commandeLive.statut === "livree_declaree" && (
        <div className="absolute inset-x-0 bottom-0 z-[400] p-4 flex flex-col items-center gap-2 bg-gradient-to-t from-black/85 via-black/50 to-transparent">
          {erreur && (
            <p role="alert" className="text-[11px] font-bold text-red-300">
              {erreur}
            </p>
          )}
          <button
            type="button"
            onClick={confirmer}
            disabled={confirmation}
            className="w-full max-w-md py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black disabled:opacity-60 cursor-pointer shadow-xl"
          >
            {confirmation ? "…" : "J'ai bien reçu mon colis"}
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
