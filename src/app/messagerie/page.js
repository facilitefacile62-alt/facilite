/* eslint-disable @next/next/no-img-element */
"use client";

import dynamic from "next/dynamic";

// Chargement dynamique du composant client Messagerie sans SSR pour éliminer à 100% l'erreur d'hydratation #418
const MessagerieClient = dynamic(() => import("./MessagerieClient"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-gray-700">Chargement de la messagerie...</p>
      </div>
    </div>
  )
});

export default function MessageriePage() {
  return <MessagerieClient />;
}
