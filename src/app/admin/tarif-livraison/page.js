"use client";

// Tarif de livraison fixé par Facilité (voir migration 20261016260000) : un montant fixe par
// livraison, appliqué aux NOUVELLES commandes. Il vaut 0 tant qu'aucun tarif n'est défini.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export default function AdminTarifLivraisonPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [actuel, setActuel] = useState(null);
  const [saisie, setSaisie] = useState("");
  const [message, setMessage] = useState(null);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(async () => {
    if (!isAdmin) return;
    const { data, error } = await supabase.rpc("lire_tarif_livraison");
    if (error) {
      setMessage({ ok: false, texte: error.message });
      return;
    }
    setActuel({ frais_xof: Number(data) || 0 });
    setSaisie(String(Number(data) || 0));
  }, [isAdmin]);

  useEffect(() => {
    // La règle ne peut pas voir que `charger` n'écrit rien avant son premier `await`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    charger();
  }, [charger]);

  const enregistrer = async (e) => {
    e.preventDefault();
    setMessage(null);
    const montant = Number(saisie);
    if (!Number.isInteger(montant) || montant < 0 || montant > 50000) {
      setMessage({ ok: false, texte: "Entrez un montant entier entre 0 et 50 000 FCFA." });
      return;
    }
    setEnCours(true);
    try {
      const { error } = await supabase.rpc("definir_tarif_livraison", { p_frais_xof: montant });
      if (error) throw new Error(error.message);
      setMessage({ ok: true, texte: montant === 0 ? "Livraison gratuite pour les nouvelles commandes." : `Tarif enregistré : ${montant.toLocaleString("fr-FR")} FCFA par livraison.` });
      await charger();
    } catch (err) {
      setMessage({ ok: false, texte: err.message });
    } finally {
      setEnCours(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-gray-400"><i className="fa-solid fa-spinner fa-spin text-2xl"></i></div>;
  }
  if (!isAdmin) {
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
      <div className="max-w-xl mx-auto px-4 py-6">
        <Link href="/admin" className="text-xs font-bold text-gray-500 hover:text-gray-800"><i className="fa-solid fa-arrow-left mr-1.5"></i>Administration</Link>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight mt-2">Tarif de livraison</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Montant fixe par livraison, appliqué aux nouvelles commandes. Facilité ne le perçoit pas : l&apos;acheteur et le livreur se règlent directement.
        </p>

        <form onSubmit={enregistrer} className="mt-5 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-5 space-y-3">
          <p className="text-xs text-gray-500">
            Tarif actuel : <strong className="text-gray-900 dark:text-white">{actuel ? (actuel.frais_xof > 0 ? `${actuel.frais_xof.toLocaleString("fr-FR")} FCFA` : "gratuit (0 FCFA)") : "…"}</strong>
          </p>
          <label htmlFor="tarif-livraison" className="block text-xs font-black text-gray-700 dark:text-gray-200">Nouveau tarif (FCFA)</label>
          <input id="tarif-livraison" type="number" inputMode="numeric" min={0} max={50000} step={1} value={saisie} onChange={(e) => setSaisie(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
          <button type="submit" disabled={enCours} className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black disabled:opacity-50 cursor-pointer">Enregistrer</button>
          {message ? <p role="status" className={`text-xs font-bold ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.texte}</p> : null}
        </form>
      </div>
    </div>
  );
}
