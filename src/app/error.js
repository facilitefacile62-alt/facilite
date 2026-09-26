"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Error({ error, reset }) {
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    console.error("[Facilité Error Boundary]:", error);
  }, [error]);

  const handleHardReload = async () => {
    setCleaning(true);
    try {
      if (typeof window !== "undefined") {
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        window.location.href = `/?_t=${Date.now()}`;
        return;
      }
    } catch {}
    reset();
  };

  return (
    <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-100 text-center animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
          ⚡
        </div>

        <h2 className="text-xl font-extrabold text-gray-900 mb-2">
          Mise à jour requise
        </h2>

        <p className="text-xs sm:text-sm text-gray-600 font-medium leading-relaxed mb-6">
          Une nouvelle version de l&apos;application est déployée. Cliquez sur le bouton pour rafraîchir complètement les composants.
        </p>

        {error?.message && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-6 text-left">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Détail</span>
            <p className="text-[11px] font-mono text-gray-700 break-words line-clamp-3">
              {error.message}
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            disabled={cleaning}
            onClick={handleHardReload}
            className="w-full py-3 px-5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer text-center"
          >
            {cleaning ? "Actualisation..." : "🔄 Actualiser la page"}
          </button>
          <Link
            href="/"
            className="w-full py-3 px-5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-xs sm:text-sm rounded-2xl transition-all text-center"
          >
            🏠 Accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
