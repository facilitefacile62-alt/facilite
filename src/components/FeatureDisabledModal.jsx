"use client";

import { useEffect, useState } from "react";

export default function FeatureDisabledModal() {
  const [modalData, setModalData] = useState({ open: false, title: "", message: "" });

  useEffect(() => {
    const handleTrigger = (e) => {
      const { title, message } = e.detail || {};
      setModalData({
        open: true,
        title: title || "Fonctionnalité non disponible",
        message:
          message ||
          "Cette fonctionnalité est temporairement désactivée le temps de finaliser les chantiers en cours. Merci pour votre compréhension !",
      });
    };

    window.addEventListener("show_feature_disabled_modal", handleTrigger);
    return () => window.removeEventListener("show_feature_disabled_modal", handleTrigger);
  }, []);

  if (!modalData.open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 dark:border-gray-800 text-center animate-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950 text-amber-500 flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
          🚧
        </div>

        <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white mb-2">
          {modalData.title}
        </h3>

        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-medium leading-relaxed mb-6">
          {modalData.message}
        </p>

        <div className="bg-orange-50/70 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/60 rounded-2xl p-3.5 mb-6 text-left flex items-start gap-2.5">
          <i className="fa-solid fa-circle-info text-orange-500 text-xs mt-0.5 shrink-0"></i>
          <p className="text-[11px] text-orange-900 dark:text-orange-200 font-medium leading-snug">
            Notre équipe technique finalise les derniers réglages. L'accès sera rétabli très prochainement.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalData({ open: false, title: "", message: "" })}
          className="w-full py-3 px-5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg shadow-orange-500/20 transition-all cursor-pointer"
        >
          Compris, merci !
        </button>
      </div>
    </div>
  );
}

/**
 * Fonction d'aide pour afficher la modal depuis n'importe quel composant
 */
export function triggerFeatureDisabledModal(title, message) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("show_feature_disabled_modal", {
        detail: { title, message },
      })
    );
  }
}
