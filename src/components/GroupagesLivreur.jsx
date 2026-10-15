"use client";

// Espace « Groupages » du livreur (onglet Livrer de la Marketplace/Locaux) :
// annoncer une tournée (départ, destination, heure, places, prix), puis gérer
// les commandes qui demandent à la rejoindre : accepter ou refuser chacune,
// partir, terminer ou annuler. Les règles métier (futur, Sénégal, 3 ouverts
// maximum, places) sont revérifiées en base ; ici on guide la saisie.
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  annulerGroupage,
  chargerMesGroupages,
  demarrerGroupage,
  listerCommandesDeMonGroupage,
  positionActuelle,
  publierGroupage,
  repondreCommandeGroupage,
  terminerGroupage,
} from "@/lib/marketplaceData";

const CarteGroupagePicker = dynamic(() => import("@/components/CarteGroupagePicker"), {
  ssr: false,
  loading: () => <div className="w-full h-[260px] rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />,
});

const LIBELLES_STATUT = { ouvert: "Ouvert", en_route: "En route", termine: "Terminé", annule: "Annulé" };
const STYLES_STATUT = {
  ouvert: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  en_route: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  termine: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  annule: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};
const LIBELLES_DECISION = { en_attente: "À accepter", acceptee: "Acceptée", refusee: "Refusée" };

// Valeur par défaut du champ date/heure : dans 2 heures, arrondi au quart d'heure, à l'heure locale.
function heureParDefaut() {
  const d = new Date(Date.now() + 2 * 3600e3);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const quand = (iso) =>
  new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const champ = "w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1877F2]";

export default function GroupagesLivreur({ userId }) {
  const { session } = useAuth();
  const [groupages, setGroupages] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [message, setMessage] = useState(null); // { ok, texte }
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const [departLibelle, setDepartLibelle] = useState("");
  const [destinationLibelle, setDestinationLibelle] = useState("");
  const [depart, setDepart] = useState(null);
  const [destination, setDestination] = useState(null);
  const [modeCarte, setModeCarte] = useState(null); // 'depart' | 'destination' | null
  const [heure, setHeure] = useState(heureParDefaut);
  const [places, setPlaces] = useState(5);
  const [frais, setFrais] = useState(1000);
  const [rayonDepart, setRayonDepart] = useState(3);
  const [rayonDestination, setRayonDestination] = useState(5);
  const [note, setNote] = useState("");
  const [trace, setTrace] = useState(null);
  const [infoTrajet, setInfoTrajet] = useState(null);

  const [detail, setDetail] = useState({}); // groupageId -> commandes
  const [ouvertId, setOuvertId] = useState(null);

  const recharger = useCallback(async () => {
    try {
      setGroupages(await chargerMesGroupages(userId));
    } catch (e) {
      setMessage({ ok: false, texte: e.message });
    }
  }, [userId]);

  useEffect(() => {
    let annule = false;
    chargerMesGroupages(userId)
      .then((d) => !annule && setGroupages(d))
      .catch((e) => !annule && setMessage({ ok: false, texte: e.message }))
      .finally(() => !annule && setChargement(false));
    return () => {
      annule = true;
    };
  }, [userId]);

  // Trajet routier entre A et B (réutilise l'API d'itinéraire de la Marketplace) ; repli : ligne droite.
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
      setMessage(null);
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
      await publierGroupage({
        departLibelle,
        departLat: depart.lat,
        departLng: depart.lng,
        destinationLibelle,
        destinationLat: destination.lat,
        destinationLng: destination.lng,
        heureDepart: new Date(heure).toISOString(),
        placesMax: Number(places),
        fraisXof: Number(frais),
        rayonDepartKm: Number(rayonDepart),
        rayonDestinationKm: Number(rayonDestination),
        note,
      });
      setMessage({ ok: true, texte: "Groupage annoncé. Les acheteurs de la zone peuvent maintenant le rejoindre." });
      setFormulaireOuvert(false);
      setDepartLibelle("");
      setDestinationLibelle("");
      setDepart(null);
      setDestination(null);
      setTrace(null);
      setInfoTrajet(null);
      setNote("");
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
      const l = await listerCommandesDeMonGroupage(id);
      setDetail((d) => ({ ...d, [id]: l }));
    } catch (e) {
      setMessage({ ok: false, texte: e.message });
    }
  };

  const basculerDetail = async (id) => {
    if (ouvertId === id) {
      setOuvertId(null);
      return;
    }
    setOuvertId(id);
    await chargerDetail(id);
  };

  const agir = async (fonction, id, texteOk, rechargerDetailDe) => {
    setMessage(null);
    setEnCours(true);
    try {
      await fonction();
      if (texteOk) setMessage({ ok: true, texte: texteOk });
      await recharger();
      if (rechargerDetailDe) await chargerDetail(rechargerDetailDe);
    } catch (e) {
      setMessage({ ok: false, texte: e.message });
    } finally {
      setEnCours(false);
    }
  };

  if (chargement) return null;

  return (
    <section className="space-y-3" aria-label="Mes groupages">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
          <i className="fa-solid fa-people-group text-[#1877F2]"></i>
          Mes groupages ({groupages.filter((g) => g.statut === "ouvert" || g.statut === "en_route").length})
        </h2>
        <button
          type="button"
          onClick={() => setFormulaireOuvert((o) => !o)}
          className="px-3 py-2 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white text-xs font-black cursor-pointer"
        >
          {formulaireOuvert ? "Fermer" : "+ Annoncer un groupage"}
        </button>
      </div>
      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        Annonce une tournée : les acheteurs qui vont dans ta direction rejoignent ton trajet au lieu de payer une course à part.
      </p>

      {message ? (
        <p role="status" className={`text-xs font-bold ${message.ok ? "text-emerald-600" : "text-red-600"}`}>{message.texte}</p>
      ) : null}

      {formulaireOuvert ? (
        <form onSubmit={publier} className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3">
          <CarteGroupagePicker depart={depart} destination={destination} trace={trace} mode={modeCarte} onPick={poser} />
          {infoTrajet ? (
            <p className="text-xs font-bold text-gray-700 dark:text-gray-200">
              <i className="fa-solid fa-route text-[#1877F2] mr-1"></i>
              Trajet : {String(infoTrajet.km).replace(".", ",")} km · environ {infoTrajet.min} min
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="gp-depart" className="text-[11px] font-black text-gray-600 dark:text-gray-300">Départ (A)</label>
              <input id="gp-depart" className={champ} value={departLibelle} onChange={(e) => setDepartLibelle(e.target.value)} placeholder="Ex. Plateau" maxLength={80} required />
              <div className="flex gap-2">
                <button type="button" onClick={maPosition} className="flex-1 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[11px] font-black cursor-pointer">
                  <i className="fa-solid fa-location-crosshairs mr-1"></i>Ma position
                </button>
                <button type="button" onClick={() => setModeCarte("depart")} className={`flex-1 py-1.5 rounded-lg text-[11px] font-black cursor-pointer ${modeCarte === "depart" ? "bg-emerald-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"}`}>
                  Sur la carte
                </button>
              </div>
              <p className="text-[10px] text-gray-500">{depart ? "Départ placé ✓" : "Pas encore placé"}</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="gp-dest" className="text-[11px] font-black text-gray-600 dark:text-gray-300">Destination (B)</label>
              <input id="gp-dest" className={champ} value={destinationLibelle} onChange={(e) => setDestinationLibelle(e.target.value)} placeholder="Ex. Keur Massar" maxLength={80} required />
              <button type="button" onClick={() => setModeCarte("destination")} className={`w-full py-1.5 rounded-lg text-[11px] font-black cursor-pointer ${modeCarte === "destination" ? "bg-red-500 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"}`}>
                Placer sur la carte
              </button>
              <p className="text-[10px] text-gray-500">{destination ? "Destination placée ✓" : "Pas encore placée"}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor="gp-heure" className="text-[11px] font-black text-gray-600 dark:text-gray-300">Heure de départ</label>
              <input id="gp-heure" type="datetime-local" className={champ} value={heure} onChange={(e) => setHeure(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <label htmlFor="gp-places" className="text-[11px] font-black text-gray-600 dark:text-gray-300">Places (commandes)</label>
              <input id="gp-places" type="number" min={1} max={30} className={champ} value={places} onChange={(e) => setPlaces(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <label htmlFor="gp-frais" className="text-[11px] font-black text-gray-600 dark:text-gray-300">Prix par livraison (FCFA)</label>
              <input id="gp-frais" type="number" min={0} max={100000} step={100} className={champ} value={frais} onChange={(e) => setFrais(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <label htmlFor="gp-rd" className="text-[11px] font-black text-gray-600 dark:text-gray-300">Retrait : boutiques à moins de</label>
              <select id="gp-rd" className={champ} value={rayonDepart} onChange={(e) => setRayonDepart(e.target.value)}>
                {[1, 2, 3, 5, 10].map((k) => <option key={k} value={k}>{k} km du départ</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="gp-rb" className="text-[11px] font-black text-gray-600 dark:text-gray-300">Livraison : clients à moins de</label>
              <select id="gp-rb" className={champ} value={rayonDestination} onChange={(e) => setRayonDestination(e.target.value)}>
                {[2, 3, 5, 10, 15].map((k) => <option key={k} value={k}>{k} km de la destination</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="gp-note" className="text-[11px] font-black text-gray-600 dark:text-gray-300">Note (facultatif)</label>
              <input id="gp-note" className={champ} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Ex. Moto, petits colis" />
            </div>
          </div>

          <button type="submit" disabled={enCours} className="w-full py-2.5 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-900 text-sm font-black disabled:opacity-60 cursor-pointer">
            {enCours ? "Publication…" : "Annoncer ce groupage"}
          </button>
        </form>
      ) : null}

      {groupages.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">Aucun groupage pour le moment.</p>
      ) : (
        <ul className="space-y-3">
          {groupages.map((g) => {
            const commandes = detail[g.id] || [];
            const actif = g.statut === "ouvert" || g.statut === "en_route";
            return (
              <li key={g.id} className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-gray-900 dark:text-white">
                      {g.depart_libelle} <i className="fa-solid fa-arrow-right text-[10px] text-gray-400 mx-1"></i> {g.destination_libelle}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {quand(g.heure_depart)} · {g.places_max} place{g.places_max > 1 ? "s" : ""} · {g.frais_par_livraison_xof.toLocaleString("fr-FR")} FCFA par livraison
                    </p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${STYLES_STATUT[g.statut]}`}>{LIBELLES_STATUT[g.statut]}</span>
                </div>

                {actif ? (
                  <button type="button" onClick={() => basculerDetail(g.id)} className="text-[11px] font-black text-[#1877F2] cursor-pointer">
                    {ouvertId === g.id ? "Masquer les commandes" : "Voir les commandes"}
                  </button>
                ) : null}

                {ouvertId === g.id ? (
                  <div className="space-y-2">
                    {commandes.length === 0 ? (
                      <p className="text-[11px] text-gray-500">Aucune commande pour l&apos;instant.</p>
                    ) : (
                      commandes.map((c) => (
                        <div key={c.id} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-black text-gray-900 dark:text-white truncate">{c.item_titre} × {c.quantite}</p>
                            <span className="text-[10px] font-black text-gray-500">{LIBELLES_DECISION[c.groupage_decision] || c.groupage_decision}</span>
                          </div>
                          <p className="text-[11px] text-gray-600 dark:text-gray-300">Retrait : {c.boutique_nom}{c.boutique_quartier ? `, ${c.boutique_quartier}` : ""}</p>
                          {c.groupage_decision === "acceptee" ? (
                            <p className="text-[11px] text-gray-600 dark:text-gray-300">
                              {c.acheteur_nom} · {c.acheteur_telephone} · {c.adresse}
                            </p>
                          ) : (
                            <p className="text-[10px] italic text-gray-400">Nom, téléphone et adresse visibles après acceptation.</p>
                          )}
                          {g.statut === "ouvert" && c.groupage_decision === "en_attente" ? (
                            <div className="flex gap-2 pt-1">
                              <button type="button" disabled={enCours} onClick={() => agir(() => repondreCommandeGroupage(c.id, true), c.id, "Commande acceptée.", g.id)} className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black disabled:opacity-60 cursor-pointer">Accepter</button>
                              <button type="button" disabled={enCours} onClick={() => agir(() => repondreCommandeGroupage(c.id, false), c.id, "Commande refusée : elle retourne aux autres livreurs.", g.id)} className="flex-1 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-[11px] font-black disabled:opacity-60 cursor-pointer">Refuser</button>
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                    {g.statut === "en_route" ? (
                      <p className="text-[11px] text-gray-500">Tes livraisons sont dans « Mes livraisons en cours » : récupère, livre, puis termine le groupage.</p>
                    ) : null}
                  </div>
                ) : null}

                {actif ? (
                  <div className="flex gap-2 pt-1">
                    {g.statut === "ouvert" ? (
                      <>
                        <button type="button" disabled={enCours} onClick={() => agir(() => demarrerGroupage(g.id), g.id, "Groupage parti. Bonne route !", g.id)} className="flex-1 py-2 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-900 text-xs font-black disabled:opacity-60 cursor-pointer">Je pars</button>
                        <button type="button" disabled={enCours} onClick={() => agir(() => annulerGroupage(g.id), g.id, "Groupage annulé.", null)} className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold disabled:opacity-60 cursor-pointer">Annuler</button>
                      </>
                    ) : (
                      <button type="button" disabled={enCours} onClick={() => agir(() => terminerGroupage(g.id), g.id, "Groupage terminé.", null)} className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black disabled:opacity-60 cursor-pointer">Terminer le groupage</button>
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
