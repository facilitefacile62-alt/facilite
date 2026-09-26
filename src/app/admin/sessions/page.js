"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

// Fréquentation RÉELLE du site web (voir 20260926050000_presence_heartbeats.sql
// et le battement envoyé depuis AuthContext.jsx). Pas de suivi mobile pour
// l'instant — l'app n'envoie aucun signal de ce type, donc rien n'est
// affiché à ce sujet ici plutôt que d'inventer une colonne vide.
const RAFRAICHISSEMENT_AUTO_MS = 60 * 1000;

function formaterDuree(minutesTotal) {
  const heures = Math.floor(minutesTotal / 60);
  const minutes = minutesTotal % 60;
  return heures > 0 ? `${heures}h ${minutes}min` : `${minutes}min`;
}

function formaterHeure(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function AdminSessionsPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [lignes, setLignes] = useState([]);
  const [minimum, setMinimum] = useState(30);
  const [minimumSaisi, setMinimumSaisi] = useState("30");
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [enregistrementMinimum, setEnregistrementMinimum] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState("tous"); // tous | en_ligne | sous_minimum
  const [dernierRafraichissement, setDernierRafraichissement] = useState(null);

  const charger = useCallback(async () => {
    setErreur("");
    try {
      const [{ data: sessions, error: erreurSessions }, { data: config, error: erreurConfig }] = await Promise.all([
        supabase.rpc("admin_lister_sessions_du_jour"),
        supabase.from("session_analytics_config").select("minimum_minutes_jour").eq("id", 1).maybeSingle(),
      ]);

      if (erreurSessions) throw erreurSessions;
      if (erreurConfig) throw erreurConfig;

      setLignes(sessions || []);
      if (config?.minimum_minutes_jour) {
        setMinimum(config.minimum_minutes_jour);
        setMinimumSaisi(String(config.minimum_minutes_jour));
      }
      setDernierRafraichissement(new Date());
    } catch (e) {
      console.error("Erreur chargement fréquentation :", e);
      setErreur("Impossible de charger les données de fréquentation. Réessayez.");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    charger();
    const intervalId = setInterval(charger, RAFRAICHISSEMENT_AUTO_MS);
    return () => clearInterval(intervalId);
  }, [isAdmin, charger]);

  const enregistrerMinimum = async () => {
    const valeur = parseInt(minimumSaisi, 10);
    if (!Number.isFinite(valeur) || valeur <= 0) {
      setErreur("Le minimum doit être un nombre de minutes positif.");
      return;
    }
    setEnregistrementMinimum(true);
    setErreur("");
    try {
      const { error } = await supabase.rpc("admin_definir_minimum_session", { p_minutes: valeur });
      if (error) throw error;
      setMinimum(valeur);
    } catch (e) {
      console.error("Erreur enregistrement minimum :", e);
      setErreur("Impossible d'enregistrer ce minimum.");
    } finally {
      setEnregistrementMinimum(false);
    }
  };

  const lignesFiltrees = useMemo(() => {
    return lignes.filter((l) => {
      if (filtre === "en_ligne" && !l.en_ligne) return false;
      if (filtre === "sous_minimum" && l.minutes_aujourdhui >= minimum) return false;
      const q = recherche.trim().toLowerCase();
      if (q && !l.nom?.toLowerCase().includes(q) && !l.email?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [lignes, filtre, recherche, minimum]);

  const stats = useMemo(() => {
    const enLigne = lignes.filter((l) => l.en_ligne).length;
    const sousMinimum = lignes.filter((l) => l.minutes_aujourdhui < minimum).length;
    const totalMinutes = lignes.reduce((s, l) => s + (l.minutes_aujourdhui || 0), 0);
    return {
      actifsAujourdhui: lignes.length,
      enLigne,
      sousMinimum,
      moyenneMinutes: lignes.length ? Math.round(totalMinutes / lignes.length) : 0,
    };
  }, [lignes, minimum]);

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-gray-400">
        <i className="fa-solid fa-spinner fa-spin text-2xl text-orange-500"></i>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <i className="fa-solid fa-lock text-3xl text-gray-300"></i>
          <p className="text-sm font-bold text-gray-700 mt-4">Réservé aux administrateurs</p>
          <Link href="/" className="mt-5 inline-block px-6 py-3 rounded-2xl bg-gray-900 text-white font-bold text-sm">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F1]/50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
          <Link href="/admin" className="hover:underline">Admin</Link>
          <span>/</span>
          <span className="text-gray-800">Fréquentation du site web</span>
        </div>

        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-extrabold text-gray-900">Fréquentation du site web</h1>
            <p className="text-xs text-gray-500 font-medium mt-1">
              Temps de présence réel aujourd&apos;hui, site web uniquement (l&apos;app mobile n&apos;a pas encore ce suivi).
            </p>
          </div>
          <div className="flex items-center gap-2">
            {dernierRafraichissement && (
              <span className="text-[11px] text-gray-400 font-medium">
                Actualisé à {formaterHeure(dernierRafraichissement.toISOString())}
              </span>
            )}
            <button
              type="button"
              onClick={charger}
              className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
            >
              <i className="fa-solid fa-rotate-right mr-1.5"></i>
              Actualiser
            </button>
          </div>
        </div>

        {erreur && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-700">
            {erreur}
          </div>
        )}

        {/* KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-5">
            <p className="text-xs font-extrabold text-gray-500">Actifs aujourd&apos;hui</p>
            <p className="text-2xl font-black text-gray-900 mt-2">{stats.actifsAujourdhui}</p>
          </div>
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-5">
            <p className="text-xs font-extrabold text-emerald-700">En ligne maintenant</p>
            <p className="text-2xl font-black text-gray-900 mt-2">{stats.enLigne}</p>
          </div>
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-5">
            <p className="text-xs font-extrabold text-gray-500">Temps moyen / jour</p>
            <p className="text-2xl font-black text-gray-900 mt-2">{formaterDuree(stats.moyenneMinutes)}</p>
          </div>
          <div className="bg-white rounded-3xl border border-red-200 shadow-xs p-5">
            <p className="text-xs font-extrabold text-red-700">Sous le minimum</p>
            <p className="text-2xl font-black text-gray-900 mt-2">{stats.sousMinimum}</p>
            <p className="text-[11px] text-gray-400 mt-1">À relancer</p>
          </div>
        </div>

        {/* Minimum requis */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div>
            <p className="text-xs font-extrabold text-gray-800">Minimum quotidien exigé</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Un utilisateur en dessous de ce seuil aujourd&apos;hui est marqué comme à relancer dans le tableau.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              value={minimumSaisi}
              onChange={(e) => setMinimumSaisi(e.target.value)}
              className="w-24 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-center focus:outline-none focus:border-orange-500"
            />
            <span className="text-xs font-bold text-gray-500">min / jour</span>
            <button
              type="button"
              onClick={enregistrerMinimum}
              disabled={enregistrementMinimum || parseInt(minimumSaisi, 10) === minimum}
              className="px-3.5 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold disabled:opacity-40 cursor-pointer"
            >
              {enregistrementMinimum ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: "tous", label: "Tous" },
              { id: "en_ligne", label: "En ligne actuellement" },
              { id: "sous_minimum", label: "Sous le minimum" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFiltre(opt.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  filtre === opt.id ? "bg-orange-500 text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="relative sm:w-64">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
            <input
              type="text"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher nom ou email…"
              className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>

        {/* Tableau */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/95 border-b border-gray-200 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Utilisateur</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4">Temps aujourd&apos;hui</th>
                  <th className="py-3 px-4">Sessions</th>
                  <th className="py-3 px-4">Dernier accès</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {chargement ? (
                  <tr>
                    <td colSpan="5" className="py-10 text-center text-gray-400">
                      <i className="fa-solid fa-spinner fa-spin mr-2"></i>Chargement…
                    </td>
                  </tr>
                ) : lignesFiltrees.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-10 text-center text-gray-400 italic">
                      {lignes.length === 0
                        ? "Personne n'a été actif sur le site aujourd'hui pour l'instant."
                        : "Aucun résultat."}
                    </td>
                  </tr>
                ) : (
                  lignesFiltrees.map((l) => {
                    const sousMinimum = l.minutes_aujourdhui < minimum;
                    return (
                      <tr key={l.user_id} className={`hover:bg-orange-50/30 transition ${sousMinimum ? "bg-red-50/40" : ""}`}>
                        <td className="py-3 px-4">
                          <p className="font-bold text-gray-900">{l.nom}</p>
                          <p className="text-[11px] text-gray-400">{l.email}</p>
                        </td>
                        <td className="py-3 px-4">
                          {l.en_ligne ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                              En ligne
                            </span>
                          ) : (
                            <span className="text-gray-400 font-bold">Hors ligne</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`font-bold ${sousMinimum ? "text-red-700" : "text-gray-800"}`}>
                            {formaterDuree(l.minutes_aujourdhui)}
                          </span>
                          {sousMinimum && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-700">
                              À relancer
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-600">{l.sessions_aujourdhui} fois</td>
                        <td className="py-3 px-4 text-gray-500">{formaterHeure(l.dernier_acces)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
