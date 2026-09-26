"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error("[Facilité Error Boundary]:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-100 text-center animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
          ⚡
        </div>

        <h2 className="text-xl font-extrabold text-gray-900 mb-2">
          Un imprévu est survenu
        </h2>

        <p className="text-xs sm:text-sm text-gray-600 font-medium leading-relaxed mb-6">
          Une erreur temporaire est survenue lors de l&apos;affichage de cette page. Cliquez ci-dessous pour recharger l&apos;interface.
        </p>

        {error?.message && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-6 text-left">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Détail technique</span>
            <p className="text-[11px] font-mono text-gray-700 break-words line-clamp-3">
              {error.message}
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              } else {
                reset();
              }
            }}
            className="w-full py-3 px-5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg shadow-orange-500/20 transition-all cursor-pointer"
          >
            🔄 Actualiser la page
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
