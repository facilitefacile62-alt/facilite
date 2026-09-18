"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
    <div className="relative min-h-[calc(100dvh-60px)] bg-[#FAF6F1]/60 dark:bg-zinc-950 font-sans flex flex-col justify-center items-center px-4 py-8 overflow-hidden transition-colors selection:bg-[#10E688] selection:text-black">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] bg-emerald-400/10 dark:bg-emerald-500/10 rounded-full blur-3xl"
      ></div>

      <main className="relative w-full max-w-[420px] z-10 animate-fade-in-up">
        <div className="bg-white dark:bg-zinc-900 rounded-[28px] sm:rounded-[32px] p-7 sm:p-9 shadow-xl border border-gray-100 dark:border-zinc-800 text-center space-y-6">
          
          {/* Icône Store avec Halo */}
          <div className="relative inline-flex items-center justify-center mx-auto">
            <div className="absolute inset-0 rounded-full bg-[#10E688]/25 dark:bg-[#10E688]/20 blur-lg scale-125"></div>
            <div className="relative w-20 h-20 rounded-full bg-[#FAF6F1]/90 dark:bg-zinc-800/90 border-2 border-emerald-100 dark:border-emerald-900/60 ring-8 ring-emerald-500/10 dark:ring-emerald-400/5 flex items-center justify-center text-3xl text-emerald-600 dark:text-emerald-400 shadow-md">
              <i className="fa-solid fa-store drop-shadow-xs"></i>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-[27px] font-black text-gray-900 dark:text-white tracking-tight leading-tight">
              Facilité Business
            </h1>
            <p className="text-[13px] sm:text-sm font-medium text-gray-500 dark:text-gray-400 leading-relaxed max-w-[320px] mx-auto">
              Comment comptez-vous utiliser la Marketplace ?
            </p>
          </div>

          <div className="space-y-3.5 pt-1">
            {/* Option Visiteur - Style Pilule avec bordure orange inspiré de Capture 1 */}
            <button
              type="button"
              onClick={choisirVisiteur}
              disabled={enCours}
              className="group relative w-full px-5 py-3.5 sm:py-4 bg-zinc-950 dark:bg-black border-2 border-[#FF7A00] hover:border-[#FF9500] active:scale-[0.98] rounded-full transition-all duration-300 cursor-pointer disabled:opacity-60 flex items-center gap-3.5 text-left shadow-[0_0_16px_-3px_rgba(255,122,0,0.3)] hover:shadow-[0_0_24px_-2px_rgba(255,122,0,0.5)] hover:bg-zinc-900"
            >
              <div className="w-10 h-10 shrink-0 rounded-full bg-[#FF7A00]/15 border border-[#FF7A00]/30 flex items-center justify-center text-[#FF7A00] text-lg group-hover:scale-110 transition-transform duration-200">
                <i className="fa-solid fa-bag-shopping"></i>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[15px] sm:text-base text-white tracking-tight leading-snug">Visiteur</p>
                <p className="text-xs text-zinc-300 dark:text-zinc-400 font-medium line-clamp-1">Je veux acheter et découvrir les offres</p>
              </div>
              <i className="fa-solid fa-chevron-right text-[#FF7A00]/80 text-xs group-hover:translate-x-1 group-hover:text-[#FF7A00] transition-all"></i>
            </button>

            {/* Option Vendeur - Style Pilule avec bordure argentée inspiré de Capture 1 */}
            <button
              type="button"
              onClick={choisirVendeur}
              disabled={enCours}
              className="group relative w-full px-5 py-3.5 sm:py-4 bg-zinc-950 dark:bg-black border-2 border-zinc-600 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 active:scale-[0.98] rounded-full transition-all duration-300 cursor-pointer disabled:opacity-60 flex items-center gap-3.5 text-left shadow-xs hover:shadow-[0_0_18px_rgba(255,255,255,0.1)] hover:bg-zinc-900"
            >
              <div className="w-10 h-10 shrink-0 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 text-lg group-hover:scale-110 transition-transform duration-200">
                <i className="fa-solid fa-store"></i>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[15px] sm:text-base text-white tracking-tight leading-snug">Vendeur</p>
                <p className="text-xs text-zinc-400 font-medium line-clamp-1">Je veux vendre et ouvrir ma boutique</p>
              </div>
              <i className="fa-solid fa-chevron-right text-zinc-500 text-xs group-hover:translate-x-1 group-hover:text-zinc-300 transition-all"></i>
            </button>
          </div>

          <div className="pt-2 border-t border-gray-100 dark:border-zinc-800/80 flex flex-col items-center">
            <button
              type="button"
              onClick={() => router.push("/bienvenue")}
              disabled={enCours}
              className="text-[12px] font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white uppercase tracking-wider transition-colors py-1 cursor-pointer"
            >
              ‹ Revenir en arrière
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


