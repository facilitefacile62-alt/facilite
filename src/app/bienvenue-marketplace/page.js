"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Étape 2 du parcours post-inscription : choix Visiteur / Vendeur, atteint
// uniquement depuis /bienvenue (choix "Facilité Business"). ?redirect=
// porte toujours la destination finale, inchangée depuis le début du
// parcours.
function BienvenueMarketplaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [enCours, setEnCours] = useState(false);

  const rawRedirect = searchParams.get("redirect") || "/";
  const safeRedirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/";

  const choisirVisiteur = () => {
    setEnCours(true);
    router.push(`/bienvenue-visiteur?redirect=${encodeURIComponent(safeRedirect)}`);
  };

  const choisirVendeur = () => {
    setEnCours(true);
    router.push(`/vendeur-informations-personnelles?redirect=${encodeURIComponent(safeRedirect)}`);
  };

  return (
    <div className="min-h-[calc(100dvh-60px)] bg-[#FAF6F1]/60 dark:bg-zinc-950 font-sans flex flex-col justify-center items-center px-3 sm:px-4 py-6 transition-colors">
      <main className="w-full max-w-md">
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-100 dark:border-zinc-800 text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl mx-auto shadow-xs">
            <i className="fa-solid fa-store"></i>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">
              Facilité Business
            </h1>
            <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 leading-relaxed">
              Comment comptez-vous utiliser la Marketplace ?
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={choisirVisiteur}
              disabled={enCours}
              className="w-full py-4 px-4 bg-white dark:bg-zinc-800 border-2 border-gray-900 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700/80 text-gray-900 dark:text-white font-black text-sm rounded-2xl transition active:scale-[0.98] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2.5 shadow-2xs"
            >
              <i className="fa-solid fa-bag-shopping text-base text-gray-700 dark:text-gray-300"></i>
              <span>Visiteur — Je veux acheter</span>
            </button>
            <button
              type="button"
              onClick={choisirVendeur}
              disabled={enCours}
              className="w-full py-4 px-4 bg-[#10E688] hover:bg-[#0ed37c] text-gray-950 font-black text-sm rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2.5"
            >
              <i className="fa-solid fa-store text-base"></i>
              <span>Vendeur — Je veux vendre</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function BienvenueMarketplacePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAF6F1] dark:bg-zinc-950 flex items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-2xl text-emerald-600"></i></div>}>
      <BienvenueMarketplaceContent />
    </Suspense>
  );
}
