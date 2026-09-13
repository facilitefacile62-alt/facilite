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
//
// Refonte visuelle (contenu de la carte uniquement) : les deux options
// passent de simples boutons à des tuiles icône + titre + description,
// pour que le choix se lise comme un vrai embranchement du produit plutôt
// que deux libellés avec tiret cadratin. Aucun changement de logique ni
// de routage.
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
    <div className="relative min-h-[calc(100dvh-60px)] bg-[#FAF6F1]/60 dark:bg-zinc-950 font-sans flex flex-col justify-center items-center px-3 sm:px-4 py-6 transition-colors overflow-hidden">
      {/* Lueur douce en fond — seul accent atmosphérique de la page, pour ne
          pas laisser un aplat crème totalement vide autour de la carte. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] bg-emerald-400/10 dark:bg-emerald-500/10 rounded-full blur-3xl"
      ></div>

      <main className="relative w-full max-w-md">
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-100 dark:border-zinc-800 text-center space-y-6">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full bg-emerald-300/30 dark:bg-emerald-500/20 blur-lg"></div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.jpeg"
              alt="Facilité"
              className="relative w-16 h-16 rounded-full object-cover shadow-md border-2 border-white dark:border-zinc-900 ring-2 ring-emerald-100 dark:ring-emerald-900"
            />
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">
              Bienvenue sur Facilité !
            </h1>
            <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 leading-relaxed">
              Par quel univers voulez-vous commencer ? Vous pourrez changer à tout moment.
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={choisirFacilite}
              disabled={enCours}
              className="w-full p-4 bg-[#10E688] hover:bg-[#0ed37c] rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-60 flex items-center gap-3.5 text-left"
            >
              <div className="w-11 h-11 shrink-0 rounded-xl bg-gray-950/10 flex items-center justify-center text-gray-950 text-lg">
                <i className="fa-solid fa-briefcase"></i>
              </div>
              <div className="min-w-0">
                <p className="font-black text-sm text-gray-950">Facilité</p>
                <p className="text-xs text-gray-950/70 font-medium">Recherche d&apos;emploi et candidatures</p>
              </div>
              <i className="fa-solid fa-chevron-right ml-auto text-gray-950/40 text-xs"></i>
            </button>

            <button
              type="button"
              onClick={choisirBusiness}
              disabled={enCours}
              className="w-full p-4 bg-white dark:bg-zinc-800 border-2 border-gray-900 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700/80 rounded-2xl transition active:scale-[0.98] cursor-pointer disabled:opacity-60 flex items-center gap-3.5 text-left shadow-2xs"
            >
              <div className="w-11 h-11 shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-lg">
                <i className="fa-solid fa-store"></i>
              </div>
              <div className="min-w-0">
                <p className="font-black text-sm text-gray-900 dark:text-white">Facilité Business</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Achetez et vendez sur la marketplace</p>
              </div>
              <i className="fa-solid fa-chevron-right ml-auto text-gray-300 dark:text-zinc-600 text-xs"></i>
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
