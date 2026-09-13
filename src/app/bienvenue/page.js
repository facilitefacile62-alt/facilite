"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Point d'entrée du nouveau parcours post-inscription (12/09/2026) : choix
// Facilité / Facilité Business. Atteint uniquement après une inscription
// réussie (voir register/page.js : e-mail confirmé via /auth/callback, ou
// téléphone une fois PHONE_SIGNUP_ENABLED actif) — jamais lors d'une
// simple connexion, ce qui explique pourquoi cette page n'a besoin
// d'aucune logique de "déjà vu" : le point d'entrée lui-même ne se
// déclenche qu'une fois par compte.
//
// ?redirect= porte la destination finale déjà en place avant ce chantier
// (comportement historique inchangé) — jamais perdue, seulement reportée
// de page en page jusqu'au bout du parcours.
function BienvenueContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [enCours, setEnCours] = useState(false);

  const rawRedirect = searchParams.get("redirect") || "/";
  // Même garde-fou anti-redirection-ouverte que /auth/callback.
  const safeRedirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/";

  const choisirFacilite = () => {
    setEnCours(true);
    router.push(safeRedirect);
  };

  const choisirBusiness = () => {
    setEnCours(true);
    router.push(`/bienvenue-marketplace?redirect=${encodeURIComponent(safeRedirect)}`);
  };

  return (
    <div className="min-h-[calc(100dvh-60px)] bg-[#FAF6F1]/60 dark:bg-zinc-950 font-sans flex flex-col justify-center items-center px-3 sm:px-4 py-6 transition-colors">
      <main className="w-full max-w-md">
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-100 dark:border-zinc-800 text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl mx-auto shadow-xs">
            <i className="fa-solid fa-sparkles"></i>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">
              Bienvenue sur Facilité !
            </h1>
            <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 leading-relaxed">
              Par quel univers voulez-vous commencer ? Vous pourrez basculer entre les deux à tout moment.
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={choisirFacilite}
              disabled={enCours}
              className="w-full py-4 px-4 bg-[#10E688] hover:bg-[#0ed37c] text-gray-950 font-black text-sm rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2.5"
            >
              <i className="fa-solid fa-briefcase text-base"></i>
              <span>Facilité — Recherche d&apos;emploi</span>
            </button>
            <button
              type="button"
              onClick={choisirBusiness}
              disabled={enCours}
              className="w-full py-4 px-4 bg-white dark:bg-zinc-800 border-2 border-gray-900 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700/80 text-gray-900 dark:text-white font-black text-sm rounded-2xl transition active:scale-[0.98] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2.5 shadow-2xs"
            >
              <i className="fa-solid fa-store text-base text-emerald-600 dark:text-emerald-400"></i>
              <span>Facilité Business — Marketplace</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function BienvenuePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAF6F1] dark:bg-zinc-950 flex items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-2xl text-emerald-600"></i></div>}>
      <BienvenueContent />
    </Suspense>
  );
}
