"use client";

import { useEffect, useState } from "react";

export default function GlobalError({ error, reset }) {
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    console.error("[Facilité Global Error Boundary]:", error);
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
    <html lang="fr">
      <body className="min-h-screen bg-[#FAF6F1] flex items-center justify-center p-4 font-sans antialiased text-gray-900">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-100 text-center">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
            🛡️
          </div>

          <h2 className="text-xl font-extrabold text-gray-900 mb-2">
            Plateforme Facilité — Récupération
          </h2>

          <p className="text-xs sm:text-sm text-gray-600 font-medium leading-relaxed mb-4">
            Une erreur s&apos;est produite lors du chargement. Détail de l&apos;erreur ci-dessous :
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-6 text-left overflow-auto max-h-40">
              <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider block mb-1">
                Erreur détectée :
              </span>
              <p className="text-xs font-mono text-red-800 break-words whitespace-pre-wrap">
                {error.message || String(error)}
              </p>
              {error.digest && (
                <span className="text-[10px] font-mono text-gray-500 block mt-1">
                  Digest: {error.digest}
                </span>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button
              type="button"
              disabled={cleaning}
              onClick={handleHardReload}
              className="w-full py-3.5 px-5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {cleaning ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Mise à jour en cours...</span>
                </>
              ) : (
                <>
                  <span>🔄 Actualiser et renouveler l&apos;application</span>
                </>
              )}
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
