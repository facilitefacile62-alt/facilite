"use client";

// Espace « Voyages » du chauffeur (onglet Livrer de la Marketplace/Locaux).
//  * pas encore chauffeur : formulaire « Devenir chauffeur » (véhicule, plaque,
//    places, au moins deux justificatifs envoyés dans un espace privé), examiné par un
//    administrateur ;
//  * chauffeur validé : annoncer un voyage, répondre aux réservations des passagers,
//    partir (la position est alors partagée avec les passagers acceptés), terminer.
// Les règles (validation, distance, places, 3 voyages ouverts) sont revérifiées en base ;
// ici on guide la saisie. Facilité ne gère aucun argent : le prix par place se règle à la montée.
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  annulerVoyage,
  chargerMesVoyages,
  chargerMonStatutChauffeur,
  demanderDevenirChauffeur,
  demarrerVoyage,
  envoyerPositionVoyage,
  listerReservationsDeMonVoyage,
  positionActuelle,
  publierVoyage,
  repondreReservationVoyage,
  terminerVoyage,
} from "@/lib/marketplaceData";

const CarteGroupagePicker = dynamic(() => import("@/components/CarteGroupagePicker"), {
  ssr: false,
  loading: () => <div className="w-full h-[260px] rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />,
});

const champ = "w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1877F2]";
const etiquette = "text-[11px] font-black text-gray-600 dark:text-gray-300";
const STATUTS = { ouvert: "Ouvert", en_route: "En route", termine: "Terminé", annule: "Annulé" };
const STYLES = {
  ouvert: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  en_route: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  termine: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  annule: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};
const DECISIONS = { en_attente: "À accepter", acceptee: "Acceptée", refusee: "Refusée", annulee: "Annulée" };

const heureParDefaut = () => {
  const d = new Date(Date.now() + 2 * 3600e3);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const quand = (iso) => new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// ---------------------------------------------------------------------------
// Demande « Devenir chauffeur »
// ---------------------------------------------------------------------------
function DemandeChauffeur({ userId, demande, onEnvoyee }) {
  const [ouvert, setOuvert] = useState(false);
  const [f, setF] = useState({ nomComplet: "", telephone: "", villeZone: "", typeVehicule: "voiture", marqueModele: "", immatriculation: "", placesPassagers: 3 });
  const [fichiers, setFichiers] = useState([]);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const maj = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const envoyer = async (e) => {
    e.preventDefault();
    setErreur("");
    if (fichiers.length < 2) {
      setErreur("Joignez au moins deux justificatifs : permis de conduire et assurance.");
      return;
    }
    setEnvoi(true);
    try {
      const chemins = [];
      for (const fichier of fichiers) {
        const nom = fichier.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const chemin = `${userId}/${Date.now()}-${nom}`;
        const { error } = await supabase.storage.from("chauffeur-documents").upload(chemin, fichier, { contentType: fichier.type });
        if (error) throw new Error("Échec du téléversement : " + error.message);
        chemins.push(chemin);
      }
      await demanderDevenirChauffeur({ ...f, placesPassagers: Number(f.placesPassagers), documentUrls: chemins });
      setOuvert(false);
      onEnvoyee();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  };

  if (demande && demande.status === "pending") {
    return (
      <div className="p-4 rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30">
        <p className="text-sm font-black text-amber-800 dark:text-amber-200"><i className="fa-solid fa-hourglass-half mr-1.5"></i>Demande de chauffeur en cours d&apos;examen</p>
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">Un administrateur vérifie vos justificatifs. Vous serez prévenu dès la décision.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {demande && demande.status === "rejected" ? (
        <p className="text-xs font-bold text-red-600">Votre dernière demande a été refusée{demande.rejection_reason ? ` : ${demande.rejection_reason}` : ""}. Vous pouvez en déposer une nouvelle.</p>
      ) : null}
      {!ouvert ? (
        <button type="button" onClick={() => setOuvert(true)} className="w-full py-2.5 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-900 text-xs font-black cursor-pointer">
          <i className="fa-solid fa-car-side mr-1.5"></i>Devenir chauffeur (transport de passagers)
        </button>
      ) : (
        <form onSubmit={envoyer} className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3">
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Transporter des personnes demande une validation : un administrateur contrôle vos justificatifs avant de vous ouvrir les voyages.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><label htmlFor="ch-nom" className={etiquette}>Nom complet</label><input id="ch-nom" className={champ} value={f.nomComplet} onChange={(e) => maj("nomComplet", e.target.value)} required minLength={2} maxLength={80} /></div>
            <div className="space-y-1"><label htmlFor="ch-tel" className={etiquette}>Téléphone</label><input id="ch-tel" type="tel" className={champ} value={f.telephone} onChange={(e) => maj("telephone", e.target.value)} required minLength={6} maxLength={20} /></div>
            <div className="space-y-1"><label htmlFor="ch-zone" className={etiquette}>Ville / zone</label><input id="ch-zone" className={champ} value={f.villeZone} onChange={(e) => maj("villeZone", e.target.value)} required maxLength={80} placeholder="Ex. Dakar" /></div>
            <div className="space-y-1">
              <label htmlFor="ch-type" className={etiquette}>Véhicule</label>
              <select id="ch-type" className={champ} value={f.typeVehicule} onChange={(e) => { maj("typeVehicule", e.target.value); if (e.target.value === "moto") maj("placesPassagers", 1); }}>
                <option value="moto">Moto (1 passager)</option><option value="voiture">Voiture</option><option value="minibus">Minibus</option>
              </select>
            </div>
            <div className="space-y-1"><label htmlFor="ch-marque" className={etiquette}>Marque et modèle</label><input id="ch-marque" className={champ} value={f.marqueModele} onChange={(e) => maj("marqueModele", e.target.value)} required minLength={2} maxLength={60} placeholder="Ex. Toyota Corolla" /></div>
            <div className="space-y-1"><label htmlFor="ch-plaque" className={etiquette}>Plaque d&apos;immatriculation</label><input id="ch-plaque" className={champ} value={f.immatriculation} onChange={(e) => maj("immatriculation", e.target.value)} required minLength={3} maxLength={20} placeholder="Ex. DK-123-AB" /></div>
            <div className="space-y-1"><label htmlFor="ch-places" className={etiquette}>Places passagers</label><input id="ch-places" type="number" min={1} max={f.typeVehicule === "moto" ? 1 : 14} className={champ} value={f.placesPassagers} onChange={(e) => maj("placesPassagers", e.target.value)} required /></div>
            <div className="space-y-1">
              <label htmlFor="ch-docs" className={etiquette}>Justificatifs (permis, assurance, carte grise…) — 2 minimum</label>
              <input id="ch-docs" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="block w-full text-xs" onChange={(e) => setFichiers(Array.from(e.target.files || []).slice(0, 5))} />
              <p className="text-[10px] text-gray-500">{fichiers.length} fichier(s) choisi(s). Stockés dans un espace privé, vus seulement par l&apos;équipe de vérification.</p>
            </div>
          </div>
          {erreur ? <p role="alert" className="text-xs font-bold text-red-600">{erreur}</p> : null}
          <div className="flex gap-2">
            <button type="submit" disabled={envoi} className="flex-1 py-2.5 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white text-sm font-black disabled:opacity-60 cursor-pointer">{envoi ? "Envoi…" : "Envoyer ma demande de chauffeur"}</button>
            <button type="button" onClick={() => setOuvert(false)} className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-bold cursor-pointer">Annuler</button>
          </div>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Voyages du chauffeur validé
// ---------------------------------------------------------------------------
function VoyagesChauffeur({ userId, chauffeur }) {
  const { session } = useAuth();
  const [voyages, setVoyages] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [message, setMessage] = useState(null);
  const [formulaire, setFormulaire] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [departLibelle, setDepartLibelle] = useState("");
  const [destinationLibelle, setDestinationLibelle] = useState("");
  const [depart, setDepart] = useState(null);
  const [destination, setDestination] = useState(null);
  const [modeCarte, setModeCarte] = useState(null);
  const [heure, setHeure] = useState(heureParDefaut);
  const [places, setPlaces] = useState(Math.min(3, chauffeur.places_passagers || 3));
  const [prix, setPrix] = useState(1000);
  const [rayonPrise, setRayonPrise] = useState(3);
  const [rayonDestination, setRayonDestination] = useState(5);
  const [note, setNote] = useState("");
  const [trace, setTrace] = useState(null);
  const [infoTrajet, setInfoTrajet] = useState(null);
  const [detail, setDetail] = useState({});
  const [ouvertId, setOuvertId] = useState(null);

  const recharger = useCallback(async () => {
    try {
      setVoyages(await chargerMesVoyages(userId));
    } catch (e) {
      setMessage({ ok: false, texte: e.message });
    }
  }, [userId]);

  useEffect(() => {
    let annule = false;
    chargerMesVoyages(userId)
      .then((d) => !annule && setVoyages(d))
      .catch((e) => !annule && setMessage({ ok: false, texte: e.message }))
      .finally(() => !annule && setChargement(false));
    return () => {
      annule = true;
    };
  }, [userId]);

  // Partage de la position pendant un voyage EN ROUTE : seuls les passagers acceptés la voient (RLS).
  const voyageEnRoute = voyages.find((v) => v.statut === "en_route")?.id ?? null;
  const derniereEnvoi = useRef(0);
  useEffect(() => {
    if (!voyageEnRoute || typeof navigator === "undefined" || !navigator.geolocation) return undefined;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        if (Date.now() - derniereEnvoi.current < 8000) return;
        derniereEnvoi.current = Date.now();
        envoyerPositionVoyage(voyageEnRoute, p.coords.latitude, p.coords.longitude).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [voyageEnRoute]);

  // Trajet routier entre A et B (API d'itinéraire de la Marketplace) ; repli : ligne droite.
  useEffect(() => {
    if (!depart || !destination || !session?.access_token) return undefined;
    let annule = false;
    fetch("/api/marketplace/itineraire", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ depart, arrivee: destination, profil: "voiture" }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("indisponible"))))
      .then((d) => {
        if (annule) return;
        setTrace(Array.isArray(d.points) && d.points.length > 1 ? d.points : null);
        setInfoTrajet({ km: d.distance_km, min: d.duree_min });
      })
      .catch(() => {
        if (annule) return;
        setTrace(null);
        setInfoTrajet(null);
      });
    return () => {
      annule = true;
    };
  }, [depart, destination, session]);

  const poser = (lat, lng) => {
    if (modeCarte === "depart") setDepart({ lat, lng });
    if (modeCarte === "destination") setDestination({ lat, lng });
    setModeCarte(null);
  };
  const maPosition = async () => {
    try {
      const p = await positionActuelle();
      setDepart({ lat: p.latitude, lng: p.longitude });
    } catch (e) {
      setMessage({ ok: false, texte: e.message });
    }
  };

  const publier = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (!depart || !destination) {
      setMessage({ ok: false, texte: "Place le départ (A) et la destination (B) sur la carte." });
      return;
    }
    setEnCours(true);
    try {
      await publierVoyage({
        departLibelle, departLat: depart.lat, departLng: depart.lng,
        destinationLibelle, destinationLat: destination.lat, destinationLng: destination.lng,
        heureDepart: new Date(heure).toISOString(), placesMax: Number(places), prixParPlaceXof: Number(prix),
        rayonPriseKm: Number(rayonPrise), rayonDestinationKm: Number(rayonDestination), note,
      });
      setMessage({ ok: true, texte: "Voyage annoncé. Les passagers de la zone peuvent maintenant réserver." });
      setFormulaire(false);
      setDepartLibelle(""); setDestinationLibelle(""); setDepart(null); setDestination(null); setTrace(null); setInfoTrajet(null); setNote("");
      setHeure(heureParDefaut());
      await recharger();
    } catch (err) {
      setMessage({ ok: false, texte: err.message });
    } finally {
      setEnCours(false);
    }
  };

  const chargerDetail = async (id) => {
    try {
      const l = await listerReservationsDeMonVoyage(id);
      setDetail((d) => ({ ...d, [id]: l }));
    } catch (e) {
      setMessage({ ok: false, texte: e.message });
    }
  };
  const basculer = async (id) => {
    if (ouvertId === id) return setOuvertId(null);
    setOuvertId(id);
    await chargerDetail(id);
  };
  const agir = async (fonction, texteOk, detailDe) => {
    setMessage(null);
    setEnCours(true);
    try {
      await fonction();
      if (texteOk) setMessage({ ok: true, texte: texteOk });
      await recharger();
      if (detailDe) await chargerDetail(detailDe);
    } catch (e) {
      setMessage({ ok: false, texte: e.message });
    } finally {
      setEnCours(false);
    }
  };

  if (chargement) return null;

  return (
    <section className="space-y-3" aria-label="Mes voyages">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
          <i className="fa-solid fa-car-side text-[#1877F2]"></i>
          Mes voyages ({voyages.filter((v) => v.statut === "ouvert" || v.statut === "en_route").length})
        </h2>
        <button type="button" onClick={() => setFormulaire((o) => !o)} className="px-3 py-2 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white text-xs font-black cursor-pointer">
          {formulaire ? "Fermer" : "+ Annoncer un voyage"}
        </button>
      </div>
      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        Chauffeur validé : {chauffeur.marque_modele} ({chauffeur.immatriculation}), {chauffeur.places_passagers} place(s). Annonce un trajet : les passagers qui vont dans ta direction réservent une place.
      </p>
      {message ? <p role="status" className={`text-xs font-bold ${message.ok ? "text-emerald-600" : "text-red-600"}`}>{message.texte}</p> : null}

      {formulaire ? (
        <form onSubmit={publier} className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3">
          <CarteGroupagePicker depart={depart} destination={destination} trace={trace} mode={modeCarte} onPick={poser} />
          {infoTrajet ? <p className="text-xs font-bold text-gray-700 dark:text-gray-200"><i className="fa-solid fa-route text-[#1877F2] mr-1"></i>Trajet : {String(infoTrajet.km).replace(".", ",")} km · environ {infoTrajet.min} min</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="vy-depart" className={etiquette}>Départ (A)</label>
              <input id="vy-depart" className={champ} value={departLibelle} onChange={(e) => setDepartLibelle(e.target.value)} placeholder="Ex. Plateau" maxLength={80} required />
              <div className="flex gap-2">
                <button type="button" onClick={maPosition} className="flex-1 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[11px] font-black cursor-pointer"><i className="fa-solid fa-location-crosshairs mr-1"></i>Ma position</button>
                <button type="button" onClick={() => setModeCarte("depart")} className={`flex-1 py-1.5 rounded-lg text-[11px] font-black cursor-pointer ${modeCarte === "depart" ? "bg-emerald-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"}`}>Sur la carte</button>
              </div>
              <p className="text-[10px] text-gray-500">{depart ? "Départ placé ✓" : "Pas encore placé"}</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="vy-dest" className={etiquette}>Destination (B)</label>
              <input id="vy-dest" className={champ} value={destinationLibelle} onChange={(e) => setDestinationLibelle(e.target.value)} placeholder="Ex. Keur Massar" maxLength={80} required />
              <button type="button" onClick={() => setModeCarte("destination")} className={`w-full py-1.5 rounded-lg text-[11px] font-black cursor-pointer ${modeCarte === "destination" ? "bg-red-500 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"}`}>Placer sur la carte</button>
              <p className="text-[10px] text-gray-500">{destination ? "Destination placée ✓" : "Pas encore placée"}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1"><label htmlFor="vy-heure" className={etiquette}>Heure de départ</label><input id="vy-heure" type="datetime-local" className={champ} value={heure} onChange={(e) => setHeure(e.target.value)} required /></div>
            <div className="space-y-1"><label htmlFor="vy-places" className={etiquette}>Places (max {chauffeur.places_passagers})</label><input id="vy-places" type="number" min={1} max={chauffeur.places_passagers} className={champ} value={places} onChange={(e) => setPlaces(e.target.value)} required /></div>
            <div className="space-y-1"><label htmlFor="vy-prix" className={etiquette}>Prix par place (FCFA)</label><input id="vy-prix" type="number" min={0} max={200000} step={100} className={champ} value={prix} onChange={(e) => setPrix(e.target.value)} required /></div>
            <div className="space-y-1">
              <label htmlFor="vy-rp" className={etiquette}>Prise en charge à moins de</label>
              <select id="vy-rp" className={champ} value={rayonPrise} onChange={(e) => setRayonPrise(e.target.value)}>{[1, 2, 3, 5, 10].map((k) => <option key={k} value={k}>{k} km du départ</option>)}</select>
            </div>
            <div className="space-y-1">
              <label htmlFor="vy-rd" className={etiquette}>Arrivée à moins de</label>
              <select id="vy-rd" className={champ} value={rayonDestination} onChange={(e) => setRayonDestination(e.target.value)}>{[2, 3, 5, 10, 15].map((k) => <option key={k} value={k}>{k} km de la destination</option>)}</select>
            </div>
            <div className="space-y-1"><label htmlFor="vy-note" className={etiquette}>Note (facultatif)</label><input id="vy-note" className={champ} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Ex. Climatisé, 1 bagage" /></div>
          </div>
          <button type="submit" disabled={enCours} className="w-full py-2.5 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-900 text-sm font-black disabled:opacity-60 cursor-pointer">{enCours ? "Publication…" : "Annoncer ce voyage"}</button>
        </form>
      ) : null}

      {voyages.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">Aucun voyage pour le moment.</p>
      ) : (
        <ul className="space-y-3">
          {voyages.map((v) => {
            const actif = v.statut === "ouvert" || v.statut === "en_route";
            const reservations = detail[v.id] || [];
            return (
              <li key={v.id} className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-gray-900 dark:text-white">{v.depart_libelle} <i className="fa-solid fa-arrow-right text-[10px] text-gray-400 mx-1"></i> {v.destination_libelle}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">{quand(v.heure_depart)} · {v.places_max} place{v.places_max > 1 ? "s" : ""} · {v.prix_par_place_xof.toLocaleString("fr-FR")} FCFA par place</p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${STYLES[v.statut]}`}>{STATUTS[v.statut]}</span>
                </div>
                {actif ? <button type="button" onClick={() => basculer(v.id)} className="text-[11px] font-black text-[#1877F2] cursor-pointer">{ouvertId === v.id ? "Masquer les réservations" : "Voir les réservations"}</button> : null}
                {ouvertId === v.id ? (
                  <div className="space-y-2">
                    {reservations.length === 0 ? <p className="text-[11px] text-gray-500">Aucune réservation pour l&apos;instant.</p> : reservations.map((r) => (
                      <div key={r.id} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-black text-gray-900 dark:text-white">{r.places} place{r.places > 1 ? "s" : ""} · {r.prise_libelle}</p>
                          <span className="text-[10px] font-black text-gray-500">{DECISIONS[r.statut] || r.statut}</span>
                        </div>
                        {r.statut === "acceptee" ? <p className="text-[11px] text-gray-600 dark:text-gray-300">{r.passager_nom || "Passager"}{r.passager_telephone ? ` · ${r.passager_telephone}` : ""}</p> : <p className="text-[10px] italic text-gray-400">Nom et téléphone visibles après acceptation.</p>}
                        {v.statut === "ouvert" && r.statut === "en_attente" ? (
                          <div className="flex gap-2 pt-1">
                            <button type="button" disabled={enCours} onClick={() => agir(() => repondreReservationVoyage(r.id, true), "Réservation acceptée.", v.id)} className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black disabled:opacity-60 cursor-pointer">Accepter</button>
                            <button type="button" disabled={enCours} onClick={() => agir(() => repondreReservationVoyage(r.id, false), "Réservation refusée.", v.id)} className="flex-1 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-[11px] font-black disabled:opacity-60 cursor-pointer">Refuser</button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                {v.statut === "en_route" ? <p className="text-[11px] text-emerald-600 font-bold"><i className="fa-solid fa-satellite-dish mr-1"></i>Ta position est partagée avec les passagers acceptés tant que cette page reste ouverte.</p> : null}
                {actif ? (
                  <div className="flex gap-2 pt-1">
                    {v.statut === "ouvert" ? (
                      <>
                        <button type="button" disabled={enCours} onClick={() => agir(() => demarrerVoyage(v.id), "Voyage parti. Bonne route !", v.id)} className="flex-1 py-2 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-900 text-xs font-black disabled:opacity-60 cursor-pointer">Je pars</button>
                        <button type="button" disabled={enCours} onClick={() => agir(() => annulerVoyage(v.id), "Voyage annulé.", null)} className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold disabled:opacity-60 cursor-pointer">Annuler</button>
                      </>
                    ) : (
                      <button type="button" disabled={enCours} onClick={() => agir(() => terminerVoyage(v.id), "Voyage terminé.", null)} className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black disabled:opacity-60 cursor-pointer">Terminer le voyage</button>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function EspaceChauffeur({ userId }) {
  const [etat, setEtat] = useState(null);

  const charger = useCallback(async () => {
    try {
      setEtat(await chargerMonStatutChauffeur(userId));
    } catch {
      setEtat({ chauffeur: null, demande: null });
    }
  }, [userId]);

  useEffect(() => {
    let annule = false;
    chargerMonStatutChauffeur(userId)
      .then((e) => !annule && setEtat(e))
      .catch(() => !annule && setEtat({ chauffeur: null, demande: null }));
    return () => {
      annule = true;
    };
  }, [userId]);

  if (!userId || !etat) return null;
  if (etat.chauffeur && etat.chauffeur.statut === "actif") return <VoyagesChauffeur userId={userId} chauffeur={etat.chauffeur} />;
  if (etat.chauffeur && etat.chauffeur.statut === "suspendu") {
    return <p className="text-xs font-bold text-red-600">Votre compte chauffeur est suspendu{etat.chauffeur.motif_suspension ? ` : ${etat.chauffeur.motif_suspension}` : ""}. Contactez-nous.</p>;
  }
  return (
    <section className="space-y-2" aria-label="Voyages">
      <h2 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
        <i className="fa-solid fa-car-side text-[#1877F2]"></i>
        Voyages — transport de passagers
      </h2>
      <DemandeChauffeur userId={userId} demande={etat.demande} onEnvoyee={charger} />
    </section>
  );
}
