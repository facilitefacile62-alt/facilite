"use client";

// Modération de l'accréditation livreur (Point 5/12 du chantier « livraison
// Marketplace »). Même philosophie que /admin/signalements et la section
// Badges de /admin : la lecture reste ouverte à admin/publisher (cohérent
// avec approve_livreur_request/reject_livreur_request côté base, qui
// acceptent les deux), mais les boutons de décision (Approuver, Rejeter,
// Suspendre) restent réservés à un administrateur — un publisher peut
// préparer le dossier, il ne signe pas (même convention que la section
// Badges de /admin/page.js).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

const VEHICULES = {
  pied: "À pied",
  velo: "Vélo",
  moto: "Moto",
  voiture: "Voiture",
};

function quand(iso) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `il y a ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
}

export default function AdminLivreursPage() {
  const { role, isAdmin, loading: authLoading } = useAuth();
  const estModerateur = isAdmin || role === "publisher";

  const [demandes, setDemandes] = useState([]);
  const [livreursActifs, setLivreursActifs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(null);
  const [motifsRejet, setMotifsRejet] = useState({});
  const [motifsSuspension, setMotifsSuspension] = useState({});

  const charger = useCallback(async () => {
    if (!estModerateur) return;
    try {
      const [{ data: d, error: eD }, { data: l, error: eL }] = await Promise.all([
        supabase.from("livreurs_demandes").select("*").eq("status", "pending").order("created_at", { ascending: true }),
        supabase.from("livreurs").select("*").eq("statut", "actif").order("created_at", { ascending: false }),
      ]);
      if (eD) throw new Error(eD.message);
      if (eL) throw new Error(eL.message);
      setDemandes(d || []);
      setLivreursActifs(l || []);
      setErreur("");
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, [estModerateur]);

  useEffect(() => {
    // Même dérogation que /admin/signalements : la règle ne peut pas voir
    // que `charger` n'écrit rien avant son premier `await`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    charger();
  }, [charger]);

  const approuver = async (id) => {
    setEnCours(id);
    try {
      const { data, error } = await supabase.rpc("approve_livreur_request", { request_id: id });
      if (error || !data) throw new Error(error?.message || "Déjà traitée.");
      await charger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(null);
    }
  };

  const rejeter = async (id) => {
    setEnCours(id);
    try {
      const { data, error } = await supabase.rpc("reject_livreur_request", {
        request_id: id,
        reason: motifsRejet[id] || "Non conforme",
      });
      if (error || !data) throw new Error(error?.message || "Déjà traitée.");
      await charger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(null);
    }
  };

  const suspendre = async (userId) => {
    setEnCours(userId);
    try {
      const { data, error } = await supabase.rpc("suspend_livreur", {
        target_user_id: userId,
        reason: motifsSuspension[userId] || "",
      });
      if (error || !data) throw new Error(error?.message || "Introuvable.");
      await charger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-gray-400">
        <i className="fa-solid fa-spinner fa-spin text-2xl"></i>
      </div>
    );
  }

  if (!estModerateur) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <i className="fa-solid fa-lock text-3xl text-gray-300"></i>
          <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mt-4">Réservé aux administrateurs</p>
          <Link href="/" className="mt-5 inline-block px-6 py-3 rounded-2xl bg-gray-900 text-white font-bold text-sm">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-3 sm:px-5 py-6">
        <header className="mb-5">
          <Link href="/admin" className="text-xs font-bold text-gray-500 hover:text-gray-800">
            <i className="fa-solid fa-arrow-left mr-1.5"></i>Administration
          </Link>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight mt-2">Livreurs</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Demandes d&apos;accréditation et livreurs actifs du circuit de livraison Marketplace.
          </p>
        </header>

        {erreur && (
          <div className="mb-4 px-4 py-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-bold text-red-800 dark:text-red-200">
            {erreur}
          </div>
        )}

        {chargement ? (
          <div className="text-center py-16 text-gray-400">
            <i className="fa-solid fa-spinner fa-spin text-2xl"></i>
          </div>
        ) : (
          <>
            {/* Demandes en attente */}
            <section className="mb-8">
              <h2 className="text-sm font-black text-gray-900 dark:text-white mb-3">
                Demandes en attente ({demandes.length})
              </h2>
              {demandes.length === 0 ? (
                <div className="text-center py-10 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800">
                  <i className="fa-solid fa-motorcycle text-2xl text-gray-300 dark:text-gray-700"></i>
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-3">Aucune demande en attente</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {demandes.map((d) => (
                    <li
                      key={d.id}
                      className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-4"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-gray-900 dark:text-white">{d.nom_complet}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {d.telephone} · {d.ville_zone} · {VEHICULES[d.type_vehicule] || d.type_vehicule}
                          </p>
                          <p className="text-[11px] text-gray-400 mt-1">
                            Demandée {quand(d.created_at)} · {d.document_urls?.length || 0} document(s) joint(s)
                          </p>
                        </div>

                        {isAdmin ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <input
                              type="text"
                              placeholder="Motif de rejet (optionnel)"
                              value={motifsRejet[d.id] || ""}
                              onChange={(e) => setMotifsRejet((prev) => ({ ...prev, [d.id]: e.target.value }))}
                              className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:outline-none focus:border-orange-500 w-40"
                            />
                            <button
                              type="button"
                              onClick={() => rejeter(d.id)}
                              disabled={enCours === d.id}
                              className="px-3.5 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs font-extrabold rounded-xl transition cursor-pointer disabled:opacity-50"
                            >
                              Rejeter
                            </button>
                            <button
                              type="button"
                              onClick={() => approuver(d.id)}
                              disabled={enCours === d.id}
                              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition cursor-pointer disabled:opacity-50"
                            >
                              Approuver
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-400 italic shrink-0">Décision réservée à un administrateur</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Livreurs actifs */}
            <section>
              <h2 className="text-sm font-black text-gray-900 dark:text-white mb-3">
                Livreurs actifs ({livreursActifs.length})
              </h2>
              {livreursActifs.length === 0 ? (
                <div className="text-center py-10 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400">Aucun livreur actif pour l&apos;instant</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {livreursActifs.map((l) => (
                    <li
                      key={l.id}
                      className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-4"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {l.telephone || "—"} · {l.zone_principale || "—"} · {VEHICULES[l.type_vehicule] || l.type_vehicule || "—"}
                          </p>
                          <p className="text-[11px] text-gray-400 mt-1">Actif depuis {quand(l.created_at)}</p>
                        </div>

                        {isAdmin && (
                          <div className="flex items-center gap-2 shrink-0">
                            <input
                              type="text"
                              placeholder="Motif de suspension"
                              value={motifsSuspension[l.user_id] || ""}
                              onChange={(e) => setMotifsSuspension((prev) => ({ ...prev, [l.user_id]: e.target.value }))}
                              className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:outline-none focus:border-orange-500 w-40"
                            />
                            <button
                              type="button"
                              onClick={() => suspendre(l.user_id)}
                              disabled={enCours === l.user_id}
                              className="px-3.5 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs font-extrabold rounded-xl transition cursor-pointer disabled:opacity-50"
                            >
                              Suspendre
                            </button>
                          </div>
                        )}
                      </div>
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
