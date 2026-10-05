"use client";

// Suivi en direct d'une livraison Marketplace, côté acheteur.
//
// La position du livreur est diffusée via Supabase Realtime sur
// marketplace_commandes (policy RLS déjà restreinte à l'acheteur/livreur/
// vendeur/admin de la ligne — un tiers abonné au même canal ne reçoit rien,
// l'isolement est structurel, pas applicatif). Aucune route/itinéraire
// recalculé ici : seule la dernière position connue du livreur est montrée,
// l'adresse de livraison de l'acheteur n'étant qu'un texte libre, pas des
// coordonnées.
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

export default function SuiviLivraisonModal({ commande, onFermer, onConfirme }) {
  const conteneur = useRef(null);
  const carteRef = useRef(null);
  const marqueurRef = useRef(null);
  const [commandeLive, setCommandeLive] = useState(commande);
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

  // Carte créée une seule fois ; le marqueur du livreur est ensuite déplacé
  // (pas recréé) à chaque mise à jour de position reçue par Realtime.
  useEffect(() => {
    let annule = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (annule || !conteneur.current || carteRef.current) return;
      const carte = L.map(conteneur.current, { zoomControl: true, scrollWheelZoom: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(carte);
      carte.setView([14.7, -17.4], 12);
      carteRef.current = carte;
    })();
    return () => {
      annule = true;
      if (carteRef.current) {
        carteRef.current.remove();
        carteRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const lat = commandeLive.livreur_position_lat;
    const lng = commandeLive.livreur_position_lng;
    if (lat == null || lng == null) return;
    let annule = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (annule || !carteRef.current) return;
      if (marqueurRef.current) {
        marqueurRef.current.setLatLng([lat, lng]);
      } else {
        // Cercle vectoriel, pas un marqueur PNG par défaut : bloqué
        // silencieusement par la CSP du site (même patron que MyRendreModal).
        marqueurRef.current = L.circleMarker([lat, lng], {
          radius: 9,
          color: "#ffffff",
          weight: 3,
          fillColor: "#2563eb",
          fillOpacity: 1,
        }).addTo(carteRef.current);
      }
      carteRef.current.setView([lat, lng], 15);
    })();
    return () => {
      annule = true;
    };
  }, [commandeLive.livreur_position_lat, commandeLive.livreur_position_lng]);

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

  const aPosition = commandeLive.livreur_position_lat != null && commandeLive.livreur_position_lng != null;

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onFermer}>
      <div
        className="w-full sm:max-w-lg bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-zinc-800">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wider text-blue-600">Suivi de livraison</p>
            <p className="text-sm font-black text-zinc-900 dark:text-white truncate">
              {commande.item?.titre || "Votre commande"}
            </p>
          </div>
          <button
            type="button"
            onClick={onFermer}
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 flex items-center justify-center"
            aria-label="Fermer"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="px-5 py-3 text-sm font-bold text-zinc-800 dark:text-zinc-200">
          {LIBELLES_STATUT[commandeLive.statut] || commandeLive.statut}
          {!aPosition && commandeLive.statut === "en_livraison" && (
            <span className="block text-xs text-zinc-500 font-medium mt-1">En attente de la position du livreur…</span>
          )}
        </div>

        <div
          ref={conteneur}
          className="w-full h-72 bg-gray-100 dark:bg-zinc-800"
          style={{ display: aPosition ? "block" : "none" }}
        />

        {commandeLive.statut === "livree_declaree" && (
          <div className="px-5 py-4 border-t border-gray-100 dark:border-zinc-800 space-y-2">
            {erreur && (
              <p role="alert" className="text-[11px] font-bold text-red-600 dark:text-red-400">
                {erreur}
              </p>
            )}
            <button
              type="button"
              onClick={confirmer}
              disabled={confirmation}
              className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black disabled:opacity-60 cursor-pointer"
            >
              {confirmation ? "…" : "J'ai bien reçu mon colis"}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
