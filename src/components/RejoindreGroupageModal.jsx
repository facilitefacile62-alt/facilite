"use client";

// Rejoindre un groupage (acheteur) : on donne le lieu où l'on veut être livré,
// on voit les tournées de livreurs qui vont dans cette direction, on en choisit
// une et la commande y est rattachée. Le livreur accepte ou refuse ensuite ;
// l'acheteur et le livreur règlent entre eux à la remise (Facilité ne gère pas
// l'argent). Les règles (boutique près du départ, livraison près de la
// destination, places) sont revérifiées en base : l'écran ne fait que guider.
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { positionActuelle, rattacherCommandeAGroupage, rechercherGroupages } from "@/lib/marketplaceData";

const CarteGroupagePicker = dynamic(() => import("@/components/CarteGroupagePicker"), {
  ssr: false,
  loading: () => <div className="w-full h-[240px] rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />,
});

const quand = (iso) =>
  new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function RejoindreGroupageModal({ commande, onFermer, onChange }) {
  const { session } = useAuth();
  const [point, setPoint] = useState(null); // lieu de livraison { lat, lng }
  const [modeCarte, setModeCarte] = useState("point");
  const [groupages, setGroupages] = useState(null); // null = pas encore cherché
  const [choisi, setChoisi] = useState(null);
  const [trace, setTrace] = useState(null);
  const [message, setMessage] = useState(null); // { ok, texte }
  const [enCours, setEnCours] = useState(false);

  // Recherche des tournées dès que le lieu de livraison est connu.
  useEffect(() => {
    if (!point) return undefined;
    let annule = false;
    rechercherGroupages({ lat: point.lat, lng: point.lng })
      .then((l) => {
        if (annule) return;
        setGroupages(l);
        setChoisi((c) => (c && l.some((g) => g.id === c.id) ? c : null));
      })
      .catch((e) => !annule && setMessage({ ok: false, texte: e.message }));
    return () => {
      annule = true;
    };
  }, [point]);

  // Trajet du groupage choisi (API d'itinéraire de la Marketplace) ; repli : ligne droite dans la carte.
  useEffect(() => {
    if (!choisi || !session?.access_token) return undefined;
    let annule = false;
    fetch("/api/marketplace/itineraire", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        depart: { lat: choisi.depart_lat, lng: choisi.depart_lng },
        arrivee: { lat: choisi.destination_lat, lng: choisi.destination_lng },
        profil: "voiture",
      }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("indisponible"))))
      .then((d) => !annule && setTrace(Array.isArray(d.points) && d.points.length > 1 ? d.points : null))
      .catch(() => !annule && setTrace(null));
    return () => {
      annule = true;
    };
  }, [choisi, session]);

  const poser = (lat, lng) => {
    setPoint({ lat, lng });
    setModeCarte(null);
    setMessage(null);
  };

  const maPosition = async () => {
    try {
      const p = await positionActuelle();
      poser(p.latitude, p.longitude);
    } catch (e) {
      setMessage({ ok: false, texte: e.message });
    }
  };

  const choisirGroupage = (g) => {
    setTrace(null);
    setChoisi(g);
  };

  const rejoindre = async () => {
    if (!choisi || !point) return;
    setEnCours(true);
    setMessage(null);
    try {
      await rattacherCommandeAGroupage({ commandeId: commande.id, groupageId: choisi.id, lat: point.lat, lng: point.lng });
      setMessage({ ok: true, texte: "Demande envoyée. Le livreur doit maintenant accepter ta commande : tu seras prévenu." });
      onChange?.();
    } catch (e) {
      setMessage({ ok: false, texte: e.message });
    } finally {
      setEnCours(false);
    }
  };

  const envoye = message?.ok === true;

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4" onClick={onFermer}>
      <div
        className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-3"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Rejoindre un groupage"
      >
        <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
            <i className="fa-solid fa-people-group text-[#1877F2]"></i>
            Rejoindre un groupage
          </h3>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 flex items-center justify-center cursor-pointer">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <p className="text-xs text-gray-600 dark:text-gray-300">
          Un livreur fait une tournée vers ta zone : tu rejoins son trajet au lieu de payer une course à part. Indique où tu veux être livré
          pour « {commande.item?.titre} ».
        </p>

        <CarteGroupagePicker
          depart={choisi ? { lat: choisi.depart_lat, lng: choisi.depart_lng } : null}
          destination={choisi ? { lat: choisi.destination_lat, lng: choisi.destination_lng } : null}
          trace={trace}
          point={point}
          mode={modeCarte}
          onPick={poser}
          hauteur={240}
        />

        <div className="flex gap-2">
          <button type="button" onClick={maPosition} className="flex-1 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-black cursor-pointer">
            <i className="fa-solid fa-location-crosshairs mr-1"></i>Je suis là
          </button>
          <button type="button" onClick={() => setModeCarte("point")} className={`flex-1 py-2 rounded-xl text-xs font-black cursor-pointer ${modeCarte === "point" ? "bg-[#1877F2] text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"}`}>
            Choisir sur la carte
          </button>
        </div>
        <p className="text-[11px] text-gray-500">{point ? "Lieu de livraison placé ✓" : "Place ton lieu de livraison pour voir les groupages."}</p>

        {message ? (
          <p role="status" className={`text-xs font-bold ${message.ok ? "text-emerald-600" : "text-red-600"}`}>{message.texte}</p>
        ) : null}

        {point && groupages !== null && !envoye ? (
          groupages.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Aucun groupage ne va vers cette zone pour l&apos;instant. Ta commande reste disponible pour les livreurs.
            </p>
          ) : (
            <ul className="space-y-2" aria-label="Groupages disponibles">
              {groupages.map((g) => {
                const selection = choisi?.id === g.id;
                const rejoignable = g.dans_la_zone && g.places_restantes > 0;
                return (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => choisirGroupage(g)}
                      className={`w-full text-left p-3 rounded-2xl border space-y-1 cursor-pointer ${selection ? "border-[#1877F2] bg-blue-50/50 dark:bg-blue-950/30" : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-black text-gray-900 dark:text-white truncate">
                          {g.depart_libelle} <i className="fa-solid fa-arrow-right text-[10px] text-gray-400 mx-1"></i> {g.destination_libelle}
                        </p>
                        <span className="shrink-0 text-xs font-black text-gray-900 dark:text-white">{g.frais_par_livraison_xof.toLocaleString("fr-FR")} FCFA</span>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Départ {quand(g.heure_depart)} · {g.places_restantes} place{g.places_restantes > 1 ? "s" : ""} restante{g.places_restantes > 1 ? "s" : ""}
                        {g.livreur_prenom ? ` · ${g.livreur_prenom}` : ""}
                        {g.type_vehicule ? ` (${g.type_vehicule})` : ""}
                      </p>
                      <p className={`text-[10px] font-black ${rejoignable ? "text-emerald-600" : "text-amber-600"}`}>
                        {g.places_restantes === 0 ? "Complet" : g.dans_la_zone ? "Va dans ta zone ✓" : `Termine à ${String(g.distance_destination_km).replace(".", ",")} km de ton lieu : hors zone`}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : null}

        {choisi && !envoye ? (
          <button
            type="button"
            onClick={rejoindre}
            disabled={enCours || !(choisi.dans_la_zone && choisi.places_restantes > 0)}
            className="w-full py-2.5 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-900 text-sm font-black disabled:opacity-50 cursor-pointer"
          >
            {enCours ? "Envoi…" : "Rejoindre ce groupage"}
          </button>
        ) : null}

        {envoye ? (
          <button type="button" onClick={onFermer} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black cursor-pointer">
            Fermer
          </button>
        ) : null}

        <p className="text-[10px] text-gray-400">Le prix de la livraison se règle directement avec le livreur à la remise.</p>
      </div>
    </div>
  );
}
