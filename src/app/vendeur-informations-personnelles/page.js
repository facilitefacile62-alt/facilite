"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

// Étape 3 (branche Vendeur) : page stub délibérée — le vrai formulaire
// (position/adresse, type de boutique produit/service/établissement) sera
// construit dans un point séparé, volontairement pas anticipé ici (voir le
// rapport de ce point). Objectif de cette version : ne jamais bloquer
// l'utilisateur — "Continuer" mène à la destination finale du parcours
// (?redirect=), comme s'il avait choisi Visiteur.
function VendeurInformationsPersonnellesContent() {
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") || "/";
  const safeRedirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/";

  return (
    <div className="min-h-[calc(100dvh-60px)] bg-[#FAF6F1]/50 font-sans flex flex-col justify-center items-center px-3 sm:px-4">
      <main className="w-full max-w-md">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-100 text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-[#10E688]/20 text-emerald-600 flex items-center justify-center text-2xl mx-auto">
            <i className="fa-solid fa-store"></i>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
              Informations personnelles
            </h1>
            <p className="text-sm font-medium text-gray-500">
              Cette étape (position, type de boutique...) arrive très bientôt. En attendant, vous pouvez déjà explorer Facilité Business.
            </p>
          </div>
          <Link
            href={safeRedirect}
            className="block w-full py-3.5 px-4 bg-[#10E688] hover:bg-[#0ed37c] text-gray-900 font-extrabold text-sm rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.99] cursor-pointer"
          >
            Continuer
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function VendeurInformationsPersonnellesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-2xl text-emerald-600"></i></div>}>
      <VendeurInformationsPersonnellesContent />
    </Suspense>
  );
}
