"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error("[Facilité Global Error Boundary]:", error);
  }, [error]);

  return (
    <html lang="fr">
      <body className="min-h-screen bg-[#FAF6F1] flex items-center justify-center p-4 font-sans antialiased text-gray-900">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-100 text-center">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
            🛡️
          </div>

          <h2 className="text-xl font-extrabold text-gray-900 mb-2">
            Plateforme Facilité — Récupération
          </h2>

          <p className="text-xs sm:text-sm text-gray-600 font-medium leading-relaxed mb-6">
            L&apos;application a rencontré un blocage inattendu. Cliquez sur le bouton pour relancer votre session en toute sécurité.
          </p>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/";
                } else {
                  reset();
                }
              }}
              className="w-full py-3 px-5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg shadow-orange-500/20 transition-all cursor-pointer"
            >
              🔄 Recharger l&apos;application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
