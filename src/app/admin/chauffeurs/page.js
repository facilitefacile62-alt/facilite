"use client";

// Modération des chauffeurs (transport de passagers). Même philosophie que /admin/livreurs :
// la lecture est ouverte aux administrateurs et modérateurs, mais les décisions
// (Approuver, Refuser, Suspendre) restent réservées à un administrateur. Les justificatifs
// (permis, assurance, carte grise) sont dans un espace privé : l'administrateur les ouvre par
// des liens signés valables 5 minutes — ils ne sont jamais publics.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

const VEHICULES = { moto: "Moto", voiture: "Voiture", minibus: "Minibus" };

function quand(iso) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `il y a ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
}

export default function AdminChauffeursPage() {
  const { role, isAdmin, loading: authLoading } = useAuth();
  const estModerateur = isAdmin || role === "publisher";

  const [demandes, setDemandes] = useState([]);
  const [actifs, setActifs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(null);
  const [motifsRejet, setMotifsRejet] = useState({});
  const [motifsSuspension, setMotifsSuspension] = useState({});

  const charger = useCallback(async () => {
    if (!estModerateur) return;
    try {
      const [{ data: d, error: eD }, { data: a, error: eA }] = await Promise.all([
        supabase.from("chauffeurs_demandes").select("*").eq("status", "pending").order("created_at", { ascending: true }),
        supabase.from("chauffeurs").select("*").eq("statut", "actif").order("created_at", { ascending: false }),
      ]);
      if (eD) throw new Error(eD.message);
      if (eA) throw new Error(eA.message);
      setDemandes(d || []);
      setActifs(a || []);
      setErreur("");
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, [estModerateur]);

  useEffect(() => {
    // La règle ne peut pas voir que `charger` n'écrit rien avant son premier `await`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    charger();
  }, [charger]);

  const rpc = async (nom, args, id) => {
    setEnCours(id);
    try {
      const { data, error } = await supabase.rpc(nom, args);
      if (error || !data) throw new Error(error?.message || "Déjà traitée.");
      await charger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(null);
    }
  };

  const voirDocument = async (chemin) => {
    const { data, error } = await supabase.storage.from("chauffeur-documents").createSignedUrl(chemin, 300);
    if (error || !data?.signedUrl) {
      setErreur(error?.message || "Document introuvable.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  if (authLoading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-gray-400"><i className="fa-solid fa-spinner fa-spin text-2xl"></i></div>;
  }
  if (!estModerateur) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 text-center">
        <div>
          <i className="fa-solid fa-lock text-3xl text-gray-300"></i>
          <p className="text-sm font-bold text-gray-700 mt-4">Réservé aux administrateurs</p>
          <Link href="/" className="mt-5 inline-block px-6 py-3 rounded-2xl bg-gray-900 text-white font-bold text-sm">Retour à l&apos;accueil</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-3 sm:px-5 py-6">
        <header className="mb-5">
          <Link href="/admin" className="text-xs font-bold text-gray-500 hover:text-gray-800"><i className="fa-solid fa-arrow-left mr-1.5"></i>Administration</Link>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight mt-2">Chauffeurs</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Demandes de chauffeurs (transport de passagers) et chauffeurs actifs. Vérifie le permis et l&apos;assurance avant d&apos;approuver.</p>
        </header>

        {erreur ? <div className="mb-4 px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-xs font-bold text-red-800">{erreur}</div> : null}

        {chargement ? (
          <div className="text-center py-16 text-gray-400"><i className="fa-solid fa-spinner fa-spin text-2xl"></i></div>
        ) : (
          <>
            <section className="mb-8">
              <h2 className="text-sm font-black text-gray-900 dark:text-white mb-3">Demandes en attente ({demandes.length})</h2>
              {demandes.length === 0 ? (
                <div className="text-center py-10 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800">
                  <i className="fa-solid fa-car-side text-2xl text-gray-300"></i>
                  <p className="text-xs font-bold text-gray-500 mt-3">Aucune demande en attente</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {demandes.map((d) => (
                    <li key={d.id} className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
                      <div>
                        <p className="text-sm font-black text-gray-900 dark:text-white">{d.nom_complet}</p>
                        <p className="text-xs text-gray-500">{d.telephone} · {d.ville_zone}</p>
                        <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                          {VEHICULES[d.type_vehicule] || d.type_vehicule} · {d.marque_modele} · plaque <strong>{d.immatriculation}</strong> · {d.places_passagers} place(s)
                        </p>
                        <p className="text-[11px] text-gray-400 mt-1">Demandée {quand(d.created_at)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(d.document_urls || []).map((chemin, i) => (
                          <button key={chemin} type="button" onClick={() => voirDocument(chemin)} className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-black cursor-pointer">
                            <i className="fa-solid fa-file-lines mr-1"></i>Justificatif {i + 1}
                          </button>
                        ))}
                      </div>
                      {isAdmin ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" disabled={enCours === d.id} onClick={() => rpc("approve_chauffeur_request", { request_id: d.id }, d.id)} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black disabled:opacity-60 cursor-pointer">Approuver</button>
                          <input type="text" aria-label="Motif du refus" placeholder="Motif du refus" value={motifsRejet[d.id] || ""} onChange={(e) => setMotifsRejet((p) => ({ ...p, [d.id]: e.target.value }))} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs w-48" />
                          <button type="button" disabled={enCours === d.id} onClick={() => rpc("reject_chauffeur_request", { request_id: d.id, reason: motifsRejet[d.id] || "Non conforme" }, d.id)} className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black disabled:opacity-60 cursor-pointer">Refuser</button>
                        </div>
                      ) : <p className="text-[11px] text-gray-400">Seul un administrateur peut décider.</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-sm font-black text-gray-900 dark:text-white mb-3">Chauffeurs actifs ({actifs.length})</h2>
              {actifs.length === 0 ? (
                <p className="text-xs text-gray-500">Aucun chauffeur actif.</p>
              ) : (
                <ul className="space-y-2">
                  {actifs.map((c) => (
                    <li key={c.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-3 flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-gray-900 dark:text-white">{c.marque_modele} · {c.immatriculation}</p>
                        <p className="text-[11px] text-gray-500">{VEHICULES[c.type_vehicule] || c.type_vehicule} · {c.places_passagers} place(s) · {c.telephone} · {c.zone_principale}</p>
                      </div>
                      {isAdmin ? (
                        <div className="flex items-center gap-2">
                          <input type="text" aria-label="Motif de la suspension" placeholder="Motif de la suspension" value={motifsSuspension[c.user_id] || ""} onChange={(e) => setMotifsSuspension((p) => ({ ...p, [c.user_id]: e.target.value }))} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs w-44" />
                          <button type="button" disabled={enCours === c.user_id} onClick={() => rpc("suspend_chauffeur", { target_user_id: c.user_id, reason: motifsSuspension[c.user_id] || "" }, c.user_id)} className="px-3 py-2 rounded-xl bg-red-50 text-red-700 text-xs font-black disabled:opacity-60 cursor-pointer">Suspendre</button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
