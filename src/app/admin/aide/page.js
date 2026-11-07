"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// Aide unifiée — coût de l'IA et réglages. Lecture par policies réservées aux admins ; modification par la
// fonction aide_modifier_reglages (réservée aux admins). L'interrupteur d'urgence coupe l'IA tout de suite,
// sans redéployer : les réponses préparées et le support humain continuent de fonctionner.
const CHAMPS = [
  { id: "limite_ia_par_jour", label: "Réponses IA par personne et par jour", min: 0, max: 200, pas: 1 },
  { id: "longueur_max_message", label: "Longueur maximale d'un message (caractères)", min: 50, max: 2000, pas: 10 },
  { id: "max_tokens", label: "Longueur maximale d'une réponse IA (jetons)", min: 50, max: 1500, pas: 10 },
  { id: "plafond_jour_usd", label: "Plafond de dépense par jour ($)", min: 0, max: 1000, pas: 0.5 },
  { id: "plafond_mois_usd", label: "Plafond de dépense par mois ($)", min: 0, max: 10000, pas: 1 },
  { id: "vocaux_par_jour", label: "Messages vocaux par personne et par jour", min: 0, max: 50, pas: 1 },
  { id: "vocal_secondes_max", label: "Durée maximale d'un vocal (secondes)", min: 5, max: 120, pas: 5 },
  { id: "conservation_vocaux_jours", label: "Conservation des vocaux après résolution (jours)", min: 1, max: 365, pas: 1 },
];

const dollars = (micro) => `${(Number(micro || 0) / 1e6).toFixed(4)} $`;

export default function AdminAidePage() {
  const [pret, setPret] = useState(false);
  const [autorise, setAutorise] = useState(false);
  const [reglages, setReglages] = useState(null);
  const [usage, setUsage] = useState([]);
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function charger() {
    const depuis = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const [{ data: r }, { data: u }] = await Promise.all([
      supabase.from("aide_reglages").select("*").eq("id", 1).maybeSingle(),
      supabase.from("aide_usage_jour").select("*").gte("jour", depuis).order("jour", { ascending: false }),
    ]);
    setReglages(r || null);
    setUsage(u || []);
  }

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return window.location.replace("/login");
      const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).maybeSingle();
      if (role?.role !== "admin") return window.location.replace("/");
      setAutorise(true);
      await charger();
      setPret(true);
    })();
  }, []);

  async function enregistrer(donnees, confirmation) {
    setEnCours(true);
    setMessage("");
    const { error } = await supabase.rpc("aide_modifier_reglages", { p_donnees: donnees });
    setEnCours(false);
    if (error) return setMessage("Enregistrement impossible : " + error.message);
    setMessage(confirmation);
    await charger();
  }

  if (!pret || !autorise) {
    return <div className="min-h-screen flex items-center justify-center text-sm font-bold text-gray-600">Chargement…</div>;
  }

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const mois = aujourdhui.slice(0, 7);
  const coutJour = usage.filter((l) => l.jour === aujourdhui).reduce((n, l) => n + Number(l.cout_micro_usd), 0);
  const coutMois = usage.filter((l) => String(l.jour).startsWith(mois)).reduce((n, l) => n + Number(l.cout_micro_usd), 0);

  return (
    <div className="min-h-screen bg-[#F7F7F8] p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-sm font-bold text-gray-500 hover:text-gray-800">← Administration</Link>
          <h1 className="text-xl font-extrabold text-gray-900">🛟 Aide unifiée : coût de l&apos;IA et réglages</h1>
        </div>

        {!reglages ? (
          <p role="alert" className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm font-semibold text-amber-900">
            Les réglages ne sont pas encore en base (la migration 20261107120000 n&apos;est pas appliquée). L&apos;IA reste coupée.
          </p>
        ) : (
          <>
            <section className="rounded-2xl bg-white border border-gray-200 p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-extrabold text-gray-900">Interrupteur d&apos;urgence de l&apos;IA</p>
                <p className="text-xs text-gray-500 mt-1">
                  {reglages.ia_active ? "L'IA répond quand les réponses préparées ne suffisent pas." : "L'IA est COUPÉE : réponses préparées et équipe uniquement."}
                </p>
              </div>
              <button
                type="button"
                disabled={enCours}
                onClick={() => enregistrer({ ia_active: !reglages.ia_active }, reglages.ia_active ? "IA coupée." : "IA activée.")}
                className={`px-5 py-2.5 rounded-xl text-sm font-extrabold text-white disabled:opacity-50 ${reglages.ia_active ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
              >
                {reglages.ia_active ? "Couper l'IA maintenant" : "Activer l'IA"}
              </button>
            </section>

            <section className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white border border-gray-200 p-5">
                <p className="text-xs font-bold text-gray-500">Dépense estimée aujourd&apos;hui</p>
                <p className="text-2xl font-extrabold text-gray-900">{dollars(coutJour)}</p>
                <p className="text-[11px] text-gray-500">plafond {Number(reglages.plafond_jour_usd).toFixed(2)} $</p>
              </div>
              <div className="rounded-2xl bg-white border border-gray-200 p-5">
                <p className="text-xs font-bold text-gray-500">Dépense estimée ce mois-ci</p>
                <p className="text-2xl font-extrabold text-gray-900">{dollars(coutMois)}</p>
                <p className="text-[11px] text-gray-500">plafond {Number(reglages.plafond_mois_usd).toFixed(2)} $</p>
              </div>
            </section>

            <form
              className="rounded-2xl bg-white border border-gray-200 p-5 grid sm:grid-cols-2 gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                enregistrer(Object.fromEntries(CHAMPS.map((c) => [c.id, Number(f.get(c.id))])), "Réglages enregistrés.");
              }}
            >
              {CHAMPS.map((c) => (
                <label key={c.id} htmlFor={`aide-${c.id}`} className="text-xs font-bold text-gray-700 flex flex-col gap-1">
                  {c.label}
                  <input
                    id={`aide-${c.id}`}
                    name={c.id}
                    type="number"
                    min={c.min}
                    max={c.max}
                    step={c.pas}
                    defaultValue={reglages[c.id]}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900"
                  />
                </label>
              ))}
              <div className="sm:col-span-2">
                <button type="submit" disabled={enCours} className="px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-extrabold disabled:opacity-50">
                  Enregistrer les réglages
                </button>
              </div>
            </form>
          </>
        )}

        {message ? <p role="status" className="text-sm font-bold text-gray-800">{message}</p> : null}

        <section className="rounded-2xl bg-white border border-gray-200 p-5 overflow-x-auto">
          <p className="font-extrabold text-gray-900 mb-3">Utilisation des 30 derniers jours</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1 pr-3">Jour</th>
                <th className="pr-3">Demandes</th>
                <th className="pr-3">Préparées</th>
                <th className="pr-3">Mémoire</th>
                <th className="pr-3">IA</th>
                <th className="pr-3">Équipe</th>
                <th className="pr-3">Jetons (entrée / sortie)</th>
                <th>Coût</th>
              </tr>
            </thead>
            <tbody>
              {usage.length === 0 ? (
                <tr><td colSpan={8} className="py-3 text-gray-400 italic">Aucune demande pour l&apos;instant.</td></tr>
              ) : (
                usage.map((l) => (
                  <tr key={l.jour} className="border-t border-gray-100 font-semibold text-gray-800">
                    <td className="py-1 pr-3">{l.jour}</td>
                    <td className="pr-3">{l.demandes}</td>
                    <td className="pr-3">{l.preparees}</td>
                    <td className="pr-3">{l.memoire}</td>
                    <td className="pr-3">{l.appels_ia}</td>
                    <td className="pr-3">{l.escalades}</td>
                    <td className="pr-3">{Number(l.jetons_entree)} / {Number(l.jetons_sortie)}</td>
                    <td>{dollars(l.cout_micro_usd)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <p className="text-[11px] text-gray-500 mt-3">Le contenu des messages n&apos;est jamais stocké ici : seulement des compteurs, des jetons et un coût estimé.</p>
        </section>
      </div>
    </div>
  );
}
