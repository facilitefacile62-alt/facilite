"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  MOTIFS_SIGNALEMENT_OFFRE,
  LONGUEUR_MAX_PRECISIONS,
  MESSAGE_CONFIRMATION_SIGNALEMENT,
  MESSAGE_ERREUR_SIGNALEMENT,
  envoyerSignalementOffre,
  offreSignalable,
} from "@/lib/signalementOffre";

// « Signaler cette offre » : réservé aux comptes connectés (un visiteur est renvoyé vers la connexion, puis revient sur la fiche).
// Le signalement est enregistré dans public.reports ; l'équipe l'examine. Le message de confirmation est neutre : il n'accuse personne.
export default function SignalerOffre({ offreId }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [precisions, setPrecisions] = useState("");
  const [etat, setEtat] = useState("repos"); // repos | envoi | envoye | erreur

  if (!offreSignalable(offreId)) return null;

  const ouvrir = async () => {
    let session = null;
    try {
      const { data } = await supabase.auth.getSession();
      session = data?.session ?? null;
    } catch {
      session = null;
    }
    if (!session?.user?.id) {
      router.push(`/login?redirect=${encodeURIComponent(`/offres/${offreId}`)}`);
      return;
    }
    setOuvert(true);
  };

  const envoyer = async (e) => {
    e.preventDefault();
    if (!motif || etat === "envoi") return;
    setEtat("envoi");
    let reporterId = null;
    try {
      const { data } = await supabase.auth.getSession();
      reporterId = data?.session?.user?.id ?? null;
    } catch {
      reporterId = null;
    }
    const resultat = await envoyerSignalementOffre(supabase, { reporterId, offreId, motifId: motif, precisions });
    setEtat(resultat.ok ? "envoye" : "erreur");
  };

  if (etat === "envoye") {
    return (
      <p role="status" data-testid="signalement-confirmation" className="mt-4 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
        {MESSAGE_CONFIRMATION_SIGNALEMENT}
      </p>
    );
  }

  return (
    <div className="mt-4">
      {!ouvert ? (
        <button
          type="button"
          onClick={ouvrir}
          data-testid="signaler-offre"
          className="inline-flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-rose-600 dark:text-gray-400 dark:hover:text-rose-400 transition"
        >
          <i className="fa-regular fa-flag" aria-hidden="true"></i>
          Signaler cette offre
        </button>
      ) : (
        <form onSubmit={envoyer} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-4 space-y-3" aria-label="Signaler cette offre">
          <fieldset>
            <legend className="text-sm font-extrabold text-gray-900 dark:text-gray-100">Pourquoi signalez-vous cette offre ?</legend>
            <div className="mt-2 space-y-1.5">
              {MOTIFS_SIGNALEMENT_OFFRE.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                  <input type="radio" name="motif-signalement" value={m.id} checked={motif === m.id} onChange={() => setMotif(m.id)} />
                  {m.libelle}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="precisions-signalement" className="block text-xs font-bold text-gray-700 dark:text-gray-300">
              Précisions (facultatif)
            </label>
            <textarea
              id="precisions-signalement"
              value={precisions}
              onChange={(e) => setPrecisions(e.target.value.slice(0, LONGUEUR_MAX_PRECISIONS))}
              rows={3}
              maxLength={LONGUEUR_MAX_PRECISIONS}
              className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>
          {etat === "erreur" && (
            <p role="alert" className="text-xs font-semibold text-rose-700 dark:text-rose-400">
              {MESSAGE_ERREUR_SIGNALEMENT}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!motif || etat === "envoi"}
              className="rounded-xl bg-gray-900 dark:bg-gray-100 px-4 py-2 text-xs font-bold text-white dark:text-gray-900 disabled:opacity-50"
            >
              {etat === "envoi" ? "Envoi…" : "Envoyer le signalement"}
            </button>
            <button type="button" onClick={() => { setOuvert(false); setEtat("repos"); }} className="text-xs font-bold text-gray-600 dark:text-gray-400 hover:underline">
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
