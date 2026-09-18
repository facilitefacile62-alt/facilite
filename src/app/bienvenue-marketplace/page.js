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
            {/* Option Visiteur - Forme Pilule rounded-full */}
            <button
              type="button"
              onClick={choisirVisiteur}
              disabled={enCours}
              className="group relative w-full px-5 py-3.5 sm:py-4 bg-white dark:bg-zinc-800/90 border-2 border-gray-900 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 active:scale-[0.98] rounded-full transition-all duration-200 cursor-pointer disabled:opacity-60 flex items-center gap-3.5 text-left shadow-xs hover:shadow-md"
            >
              <div className="w-10 h-10 shrink-0 rounded-full bg-gray-100 dark:bg-zinc-700/60 flex items-center justify-center text-gray-900 dark:text-white text-base group-hover:scale-105 transition-transform">
                <i className="fa-solid fa-bag-shopping"></i>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-black text-[15px] text-gray-900 dark:text-white tracking-tight">Visiteur</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium line-clamp-1">Je veux acheter et découvrir les offres</p>
              </div>
              <i className="fa-solid fa-chevron-right text-gray-300 dark:text-zinc-600 text-xs group-hover:translate-x-0.5 group-hover:text-gray-500 transition-all"></i>
            </button>

            {/* Option Vendeur - Forme Pilule rounded-full */}
            <button
              type="button"
              onClick={choisirVendeur}
              disabled={enCours}
              className="group relative w-full px-5 py-3.5 sm:py-4 bg-[#10E688] hover:bg-[#0fd67e] active:scale-[0.98] rounded-full shadow-[0_8px_20px_-4px_rgba(16,230,136,0.4)] hover:shadow-[0_10px_25px_-3px_rgba(16,230,136,0.5)] transition-all duration-200 cursor-pointer disabled:opacity-60 flex items-center gap-3.5 text-left border border-emerald-300/40"
            >
              <div className="w-10 h-10 shrink-0 rounded-full bg-gray-950/10 dark:bg-black/15 flex items-center justify-center text-gray-950 text-base group-hover:scale-105 transition-transform">
                <i className="fa-solid fa-store"></i>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-black text-[15px] text-gray-950 tracking-tight">Vendeur</p>
                <p className="text-xs text-gray-950/75 font-semibold line-clamp-1">Je veux vendre et ouvrir ma boutique</p>
              </div>
              <i className="fa-solid fa-chevron-right text-gray-950/40 text-xs group-hover:translate-x-0.5 group-hover:text-gray-950/70 transition-all"></i>
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


