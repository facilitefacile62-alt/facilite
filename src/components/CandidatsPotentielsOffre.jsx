"use client";
/* eslint-disable @next/next/no-img-element */

// Aperçu automatique des candidats les plus proches d'une offre, affiché
// sans action du recruteur — contrairement au bouton "Matching IA (RAG)"
// existant (src/app/recruteur/page.js), qui reste le chemin pour une
// analyse LLM détaillée à la demande. Voir la route API pour pourquoi ce
// panneau n'appelle jamais de LLM lui-même (coût/quota).
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function CandidatsPotentielsOffre({ offerId }) {
  const [candidats, setCandidats] = useState(null); // null = chargement
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let annule = false;

    async function charger() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const res = await fetch(`/api/recruteur/offres/${offerId}/candidats-potentiels`, {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
        const data = await res.json().catch(() => null);
        if (annule) return;
        if (res.ok && data) {
          setCandidats(data.candidats || []);
        } else {
          setErreur(true);
        }
      } catch {
        if (!annule) setErreur(true);
      }
    }

    charger();
    return () => {
      annule = true;
    };
  }, [offerId]);

  // Discret par conception : ni erreur ni liste vide n'affichent quoi que ce
  // soit — ce n'est qu'un aperçu, pas une fonctionnalité que l'absence de
  // résultat doit signaler comme un problème.
  if (erreur || (candidats && candidats.length === 0)) return null;

  if (!candidats) {
    return (
      <div className="px-3 pb-3 -mt-2">
        <p className="text-[11px] text-gray-400 font-medium">
          <i className="fa-solid fa-spinner fa-spin mr-1.5"></i>
          Recherche de candidats potentiels…
        </p>
      </div>
    );
  }

  return (
    <div className="px-3 pb-3 -mt-1">
      <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3">
        <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wider mb-2">
          <i className="fa-solid fa-star mr-1"></i>
          Candidats à fort potentiel identifiés
        </p>
        <div className="flex flex-wrap gap-2">
          {candidats.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 bg-white border border-emerald-200 rounded-full pl-1 pr-2.5 py-1 text-[11px] font-bold text-gray-800"
              title={`Offre très favorable pour la candidature de ${c.nomComplet}`}
            >
              {c.avatarUrl ? (
                <img src={c.avatarUrl} alt={c.nomComplet} className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[9px] font-black">
                  {c.nomComplet.charAt(0)}
                </span>
              )}
              {c.nomComplet}
              <span className="text-emerald-700 font-black">{c.score}%</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
