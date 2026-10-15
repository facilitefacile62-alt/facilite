"use client";

// Voyages côté passager (Locaux) : chercher un voyage de chauffeur qui fait mon trajet,
// réserver des places, suivre mes réservations et, une fois acceptée, voir le chauffeur
// (nom, téléphone, véhicule, plaque) et le suivre EN DIRECT sur la carte quand le voyage
// est parti. Les règles (distance de prise en charge et d'arrivée, places, une réservation
// active par voyage) sont revérifiées en base ; ici on guide la saisie. Facilité ne gère
// aucun argent : le prix par place se règle au chauffeur à la montée.
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  annulerReservationVoyage,
  chargerMesReservationsVoyage,
  chargerPositionVoyage,
  chargerVoyagesParIds,
  infosChauffeurDeMaReservation,
  positionActuelle,
  rechercherVoyages,
  reserverVoyage,
} from "@/lib/marketplaceData";

const CarteGroupagePicker = dynamic(() => import("@/components/CarteGroupagePicker"), {
  ssr: false,
  loading: () => <div className="w-full h-[240px] rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />,
});

const quand = (iso) => new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const champ = "w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1877F2]";
const LIBELLES = { en_attente: "En attente du chauffeur", acceptee: "Acceptée", refusee: "Refusée", annulee: "Annulée" };
const STYLES = {
  en_attente: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  acceptee: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  refusee: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  annulee: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
};

// ---------------------------------------------------------------------------
// Suivi en direct du chauffeur (réservation acceptée, voyage en route)
// ---------------------------------------------------------------------------
function SuiviVoyage({ voyage, onFermer }) {
  const [position, setPosition] = useState(null);
  const [trace, setTrace] = useState([]);
  const [derniere, setDerniere] = useState(null);

  const recevoir = useCallback((p) => {
    if (!p || p.lat == null || p.lng == null) return;
    setPosition({ lat: p.lat, lng: p.lng });
    setDerniere(p.maj_le || null);
    setTrace((t) => {
      const fin = t[t.length - 1];
      return fin && fin[0] === p.lat && fin[1] === p.lng ? t : [...t, [p.lat, p.lng]].slice(-600);
    });
  }, []);

  useEffect(() => {
    let annule = false;
    chargerPositionVoyage(voyage.id)
      .then((p) => !annule && recevoir(p))
      .catch(() => {});
    // Realtime : la RLS ne diffuse qu'au chauffeur et aux passagers acceptés de CE voyage.
    const canal = supabase
      .channel(`suivi-voyage-${voyage.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "voyages_positions", filter: `voyage_id=eq.${voyage.id}` },
        (payload) => recevoir(payload.new)
      )
      .subscribe();
    return () => {
      annule = true;
      supabase.removeChannel(canal);
    };
  }, [voyage.id, recevoir]);

  return (
    <div className="fixed inset-0 z-[90] bg-[#0B0F17]" role="dialog" aria-label="Suivi du chauffeur" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-0">
        <CarteGroupagePicker
          depart={{ lat: voyage.depart_lat, lng: voyage.depart_lng }}
          destination={{ lat: voyage.destination_lat, lng: voyage.destination_lng }}
          trace={trace.length > 1 ? trace : null}
          point={position}
          pointLibelle="🚗"
          pointCouleur="#2563EB"
          mode={null}
          hauteur="100vh"
        />
      </div>
      <div className="absolute inset-x-0 top-0 z-[400] p-3 flex items-start justify-between gap-3 bg-gradient-to-b from-black/85 via-black/45 to-transparent pointer-events-none">
        <div className="pointer-events-auto rounded-2xl bg-black/65 backdrop-blur-md border border-white/15 px-4 py-2.5 max-w-[80%]">
          <p className="text-[10px] font-black uppercase tracking-wider text-sky-300">Suivi du chauffeur</p>
          <p className="text-sm font-black text-white truncate">{voyage.depart_libelle} → {voyage.destination_libelle}</p>
          <p className="text-xs font-bold text-gray-200">
            {position ? `Position reçue${derniere ? " à " + new Date(derniere).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ""}` : "En attente de la position du chauffeur…"}
          </p>
        </div>
        <button type="button" onClick={onFermer} aria-label="Fermer le suivi" className="pointer-events-auto w-10 h-10 rounded-full bg-black/65 hover:bg-black/85 border border-white/20 text-white flex items-center justify-center cursor-pointer shrink-0">
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onglet « Chercher »
// ---------------------------------------------------------------------------
function RechercheVoyage({ onReserve }) {
  const { session } = useAuth();
  const [prise, setPrise] = useState(null);
  const [dest, setDest] = useState(null);
  const [mode, setMode] = useState("depart");
  const [voyages, setVoyages] = useState(null);
  const [choisi, setChoisi] = useState(null);
  const [trace, setTrace] = useState(null);
  const [places, setPlaces] = useState(1);
  const [priseLibelle, setPriseLibelle] = useState("");
  const [message, setMessage] = useState(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!prise || !dest) return undefined;
    let annule = false;
    rechercherVoyages({ priseLat: prise.lat, priseLng: prise.lng, destLat: dest.lat, destLng: dest.lng })
      .then((l) => {
        if (annule) return;
        setVoyages(l);
        setChoisi((c) => (c && l.some((v) => v.id === c.id) ? c : null));
      })
      .catch((e) => !annule && setMessage({ ok: false, texte: e.message }));
    return () => {
      annule = true;
    };
  }, [prise, dest]);

  useEffect(() => {
    if (!choisi || !session?.access_token) return undefined;
    let annule = false;
    fetch("/api/marketplace/itineraire", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ depart: { lat: choisi.depart_lat, lng: choisi.depart_lng }, arrivee: { lat: choisi.destination_lat, lng: choisi.destination_lng }, profil: "voiture" }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("indisponible"))))
      .then((d) => !annule && setTrace(Array.isArray(d.points) && d.points.length > 1 ? d.points : null))
      .catch(() => !annule && setTrace(null));
    return () => {
      annule = true;
    };
  }, [choisi, session]);

  const poser = (lat, lng) => {
    if (mode === "depart") {
      setPrise({ lat, lng });
      setMode("destination");
    } else if (mode === "destination") {
      setDest({ lat, lng });
      setMode(null);
    }
    setMessage(null);
  };
  const maPosition = async () => {
    try {
      const p = await positionActuelle();
      setPrise({ lat: p.latitude, lng: p.longitude });
      setMode("destination");
      if (!priseLibelle) setPriseLibelle("Ma position");
    } catch (e) {
      setMessage({ ok: false, texte: e.message });
    }
  };

  const reserver = async () => {
    if (!choisi || !prise || !dest) return;
    setEnCours(true);
    setMessage(null);
    try {
      await reserverVoyage({ voyageId: choisi.id, places: Number(places), priseLibelle: priseLibelle || "Ma position", priseLat: prise.lat, priseLng: prise.lng, destLat: dest.lat, destLng: dest.lng });
      setMessage({ ok: true, texte: "Demande envoyée. Le chauffeur doit l'accepter : tu seras prévenu." });
      setChoisi(null);
      onReserve?.();
    } catch (e) {
      setMessage({ ok: false, texte: e.message });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-600 dark:text-gray-300">Dis d&apos;où tu pars (A) et où tu vas (B) : tu vois les chauffeurs qui font ce trajet et tu réserves une place.</p>
      <CarteGroupagePicker depart={prise} destination={dest} trace={trace} mode={mode} onPick={poser} hauteur={240} />
      <div className="flex gap-2">
        <button type="button" onClick={maPosition} className="flex-1 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-black cursor-pointer"><i className="fa-solid fa-location-crosshairs mr-1"></i>Je pars d&apos;ici (A)</button>
        <button type="button" onClick={() => setMode("depart")} className={`flex-1 py-2 rounded-xl text-xs font-black cursor-pointer ${mode === "depart" ? "bg-emerald-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"}`}>A sur la carte</button>
        <button type="button" onClick={() => setMode("destination")} className={`flex-1 py-2 rounded-xl text-xs font-black cursor-pointer ${mode === "destination" ? "bg-red-500 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"}`}>B sur la carte</button>
      </div>
      <p className="text-[11px] text-gray-500">{prise ? "Départ (A) placé ✓" : "Place ton départ (A)."} {dest ? "Destination (B) placée ✓" : "Place ta destination (B)."}</p>
      {message ? <p role="status" className={`text-xs font-bold ${message.ok ? "text-emerald-600" : "text-red-600"}`}>{message.texte}</p> : null}

      {prise && dest && voyages !== null ? (
        voyages.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">Aucun voyage ne fait ce trajet pour l&apos;instant. Reviens plus tard : les chauffeurs en annoncent régulièrement.</p>
        ) : (
          <ul className="space-y-2" aria-label="Voyages disponibles">
            {voyages.map((v) => {
              const sel = choisi?.id === v.id;
              return (
                <li key={v.id}>
                  <button type="button" onClick={() => { setTrace(null); setChoisi(v); }} className={`w-full text-left p-3 rounded-2xl border space-y-1 cursor-pointer ${sel ? "border-[#1877F2] bg-blue-50/50 dark:bg-blue-950/30" : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-black text-gray-900 dark:text-white truncate">{v.depart_libelle} <i className="fa-solid fa-arrow-right text-[10px] text-gray-400 mx-1"></i> {v.destination_libelle}</p>
                      <span className="shrink-0 text-xs font-black text-gray-900 dark:text-white">{v.prix_par_place_xof.toLocaleString("fr-FR")} FCFA / place</span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Départ {quand(v.heure_depart)} · {v.places_restantes} place{v.places_restantes > 1 ? "s" : ""} restante{v.places_restantes > 1 ? "s" : ""}
                      {v.chauffeur_prenom ? ` · ${v.chauffeur_prenom}` : ""}{v.type_vehicule ? ` (${v.type_vehicule})` : ""}
                    </p>
                    <p className={`text-[10px] font-black ${v.dans_la_zone && v.places_restantes > 0 ? "text-emerald-600" : "text-amber-600"}`}>
                      {v.places_restantes === 0 ? "Complet" : v.dans_la_zone ? "Fait ton trajet ✓" : `Départ à ${String(v.distance_prise_km).replace(".", ",")} km de toi, arrivée à ${String(v.distance_destination_km).replace(".", ",")} km de ta destination : hors zone`}
                    </p>
                    {v.note ? <p className="text-[10px] italic text-gray-500">{v.note}</p> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )
      ) : null}

      {choisi ? (
        <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1"><label htmlFor="rv-lieu" className="text-[11px] font-black text-gray-600 dark:text-gray-300">Où le chauffeur te prend (nom du lieu)</label><input id="rv-lieu" className={champ} value={priseLibelle} onChange={(e) => setPriseLibelle(e.target.value)} placeholder="Ex. Devant la poste du Plateau" maxLength={80} /></div>
            <div className="space-y-1"><label htmlFor="rv-places" className="text-[11px] font-black text-gray-600 dark:text-gray-300">Places</label><input id="rv-places" type="number" min={1} max={Math.min(4, Math.max(1, choisi.places_restantes))} className={champ} value={places} onChange={(e) => setPlaces(e.target.value)} /></div>
          </div>
          <button type="button" onClick={reserver} disabled={enCours || !(choisi.dans_la_zone && choisi.places_restantes > 0)} className="w-full py-2.5 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-900 text-sm font-black disabled:opacity-50 cursor-pointer">
            {enCours ? "Envoi…" : `Réserver ${places} place${Number(places) > 1 ? "s" : ""} · ${(choisi.prix_par_place_xof * Number(places || 1)).toLocaleString("fr-FR")} FCFA`}
          </button>
          <p className="text-[10px] text-gray-500">Le prix se règle directement au chauffeur à la montée.</p>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onglet « Mes réservations »
// ---------------------------------------------------------------------------
function MesReservations({ userId, declencheur }) {
  const [liste, setListe] = useState([]);
  const [voyages, setVoyages] = useState({});
  const [chauffeurs, setChauffeurs] = useState({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [suivi, setSuivi] = useState(null);
  const [occupee, setOccupee] = useState(null);

  // Chargement unique (et rechargement quand `version` change : réservation modifiée, annulation).
  const [version, setVersion] = useState(0);
  const rafraichir = useCallback(() => setVersion((n) => n + 1), []);

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const l = await chargerMesReservationsVoyage(userId);
        const vs = await chargerVoyagesParIds(l.map((r) => r.voyage_id));
        const acceptees = l.filter((r) => r.statut === "acceptee");
        const infos = await Promise.all(acceptees.map((r) => infosChauffeurDeMaReservation(r.id).catch(() => null)));
        if (annule) return;
        setListe(l);
        setVoyages(vs);
        setChauffeurs(Object.fromEntries(acceptees.map((r, i) => [r.id, infos[i]])));
      } catch (e) {
        if (!annule) setErreur(e.message);
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [userId, declencheur, version]);

  // Une réservation qui change (acceptée, refusée…) met la liste à jour sans recharger la page.
  useEffect(() => {
    const canal = supabase
      .channel(`mes-reservations-voyage-${userId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "voyages_reservations", filter: `passager_id=eq.${userId}` }, () => rafraichir())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [userId, rafraichir]);

  const annuler = async (id) => {
    setOccupee(id);
    try {
      await annulerReservationVoyage(id);
      rafraichir();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setOccupee(null);
    }
  };

  if (chargement) return <p className="text-xs text-gray-400 py-6 text-center">Chargement…</p>;
  return (
    <div className="space-y-3">
      {erreur ? <p role="alert" className="text-xs font-bold text-red-600">{erreur}</p> : null}
      {liste.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 py-6 text-center">Aucune réservation pour l&apos;instant.</p>
      ) : (
        <ul className="space-y-3">
          {liste.map((r) => {
            const v = voyages[r.voyage_id];
            const ch = chauffeurs[r.id];
            const actif = r.statut === "en_attente" || r.statut === "acceptee";
            return (
              <li key={r.id} className="p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-gray-900 dark:text-white">{v ? <>{v.depart_libelle} <i className="fa-solid fa-arrow-right text-[10px] text-gray-400 mx-1"></i> {v.destination_libelle}</> : "Voyage terminé ou annulé"}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">{r.places} place{r.places > 1 ? "s" : ""} · prise en charge : {r.prise_libelle}{v ? ` · départ ${quand(v.heure_depart)}` : ""}</p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${STYLES[r.statut]}`}>{LIBELLES[r.statut]}</span>
                </div>
                {r.statut === "acceptee" && v ? (
                  <p className="text-[11px] text-gray-700 dark:text-gray-200">
                    {(v.prix_par_place_xof * r.places).toLocaleString("fr-FR")} FCFA à régler au chauffeur à la montée.
                  </p>
                ) : null}
                {ch ? (
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-[11px] text-gray-800 dark:text-gray-100 space-y-0.5">
                    <p className="font-black">{ch.chauffeur_nom || "Chauffeur"}{ch.telephone ? ` · ${ch.telephone}` : ""}</p>
                    <p>{ch.marque_modele} · plaque <strong>{ch.immatriculation}</strong></p>
                    <p className="text-[10px] text-gray-500">Vérifie la plaque avant de monter.</p>
                  </div>
                ) : null}
                <div className="flex gap-2 pt-0.5">
                  {r.statut === "acceptee" && v && v.statut === "en_route" ? (
                    <button type="button" onClick={() => setSuivi(v)} className="flex-1 py-2 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white text-xs font-black cursor-pointer"><i className="fa-solid fa-location-dot mr-1"></i>Suivre le chauffeur</button>
                  ) : null}
                  {actif && v && v.statut === "ouvert" ? (
                    <button type="button" disabled={occupee === r.id} onClick={() => annuler(r.id)} className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-red-600 text-xs font-black disabled:opacity-60 cursor-pointer">Annuler ma réservation</button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {suivi ? <SuiviVoyage voyage={suivi} onFermer={() => setSuivi(null)} /> : null}
    </div>
  );
}

export default function VoyagesPassager({ userId, onFermer }) {
  const [onglet, setOnglet] = useState("chercher");
  const [declencheur, setDeclencheur] = useState(0);

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4" onClick={onFermer}>
      <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-3" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Voyages">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2"><i className="fa-solid fa-car-side text-[#1877F2]"></i>Voyages</h3>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 flex items-center justify-center cursor-pointer"><i className="fa-solid fa-xmark"></i></button>
        </div>
        <div className="flex gap-2" role="tablist">
          {[["chercher", "Chercher un voyage"], ["reservations", "Mes réservations"]].map(([id, libelle]) => (
            <button key={id} type="button" role="tab" aria-selected={onglet === id} onClick={() => setOnglet(id)} className={`flex-1 py-2 rounded-xl text-xs font-black cursor-pointer ${onglet === id ? "bg-zinc-950 dark:bg-white text-white dark:text-zinc-900" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"}`}>{libelle}</button>
          ))}
        </div>
        {!userId ? (
          <p className="text-xs text-gray-500 text-center py-6">Connecte-toi pour chercher et réserver un voyage.</p>
        ) : onglet === "chercher" ? (
          <RechercheVoyage onReserve={() => setDeclencheur((n) => n + 1)} />
        ) : (
          <MesReservations userId={userId} declencheur={declencheur} />
        )}
      </div>
    </div>
  );
}
