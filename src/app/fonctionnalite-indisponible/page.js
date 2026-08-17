"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

// Destination du middleware (src/proxy.js) quand une navigation DIRECTE
// (URL tapée, favori...) vise une route désactivée depuis /admin — n'est
// jamais atteinte autrement qu'après le contrôle d'accès normal (donc
// toujours par un utilisateur déjà authentifié, PUBLIC_ROUTES inchangé).
// Réutilise le même langage visuel que FeatureDisabledModal.jsx (icône,
// ton, bandeau d'info), en page pleine plutôt qu'en superposition.
function FeatureUnavailableContent() {
  const searchParams = useSearchParams();
  const from = searchParams?.get("from") || "";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#FAF6F1]">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
          🚧
        </div>

        <h1 className="text-lg sm:text-xl font-extrabold text-gray-900 mb-2">
          Fonctionnalité non disponible
        </h1>

        <p className="text-xs sm:text-sm text-gray-600 font-medium leading-relaxed mb-6">
          Cette fonctionnalité est temporairement désactivée le temps de finaliser les chantiers en cours. Merci pour votre compréhension !
        </p>

        <div className="bg-orange-50/70 border border-orange-200/60 rounded-2xl p-3.5 mb-6 text-left flex items-start gap-2.5">
          <i className="fa-solid fa-circle-info text-orange-500 text-xs mt-0.5 shrink-0"></i>
          <p className="text-[11px] text-orange-900 font-medium leading-snug">
            Notre équipe technique finalise les derniers réglages. L'accès sera rétabli très prochainement.
            {from ? ` (Page demandée : ${from})` : ""}
          </p>
        </div>

        <Link
          href="/"
          className="w-full inline-block py-3 px-5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg shadow-orange-500/20 transition-all"
        >
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}

export default function FeatureUnavailablePage() {
  return (
    <Suspense fallback={null}>
      <FeatureUnavailableContent />
    </Suspense>
  );
}
