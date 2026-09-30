"use client";

// Étape 1/2 de l'onboarding "scanner un document" après inscription (voir
// /bienvenue, qui redirige ici après le choix Facilité/Business — uniquement
// pour le côté candidat, la Marketplace n'a pas besoin d'une pièce
// d'identité ou d'un CV à l'inscription).
//
// Choix du TYPE de document avant l'action elle-même (page suivante,
// /bienvenue/scanner) : évite de deviner via une détection automatique
// (comme le fait /profil/page.js) — l'utilisateur sait déjà ce qu'il tient
// entre les mains.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const DOCUMENTS = [
  {
    type: "cni",
    icone: "fa-id-card",
    titre: "Carte d'identité (CNI)",
    description: "Pré-remplit votre nom, prénom et quartier.",
  },
  {
    type: "passeport",
    icone: "fa-passport",
    titre: "Passeport",
    description: "Pré-remplit votre nom, prénom et quartier.",
  },
  {
    type: "cv",
    icone: "fa-file-lines",
    titre: "Mon CV",
    description: "Ajoute directement votre CV existant à votre profil.",
  },
];

function ChoixDocumentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") || "/";
  const safeRedirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/";

  const choisir = (type) => {
    router.push(`/bienvenue/scanner?type=${type}&redirect=${encodeURIComponent(safeRedirect)}`);
  };

  return (
    <div className="min-h-[calc(100dvh-60px)] bg-[#FAF6F1]/60 dark:bg-zinc-950 font-sans flex flex-col justify-center items-center px-4 py-8">
      <main className="w-full max-w-[440px] animate-fade-in-up">
        <div className="bg-white dark:bg-zinc-900 rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 shadow-xl border border-gray-100 dark:border-zinc-800 text-center space-y-5">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#E8FAF0] dark:bg-emerald-950/60 flex items-center justify-center text-[#10E688] text-2xl">
            <i className="fa-solid fa-camera-retro"></i>
          </div>

          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              Un dernier détail
            </h1>
            <p className="text-[13px] sm:text-sm font-medium text-gray-500 dark:text-gray-400 leading-relaxed max-w-[340px] mx-auto">
              Scannez un document pour compléter votre profil en quelques secondes. Quel document avez-vous sous la main ?
            </p>
          </div>

          <div className="space-y-3 pt-1 text-left">
            {DOCUMENTS.map((doc) => (
              <button
                key={doc.type}
                type="button"
                onClick={() => choisir(doc.type)}
                className="group w-full px-4 py-3.5 bg-gray-50 dark:bg-zinc-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-gray-200 dark:border-zinc-700 hover:border-emerald-300 rounded-2xl transition-all cursor-pointer flex items-center gap-3.5"
              >
                <div className="w-10 h-10 shrink-0 rounded-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 flex items-center justify-center text-gray-700 dark:text-gray-300 group-hover:text-emerald-600 group-hover:border-emerald-300 transition-colors">
                  <i className={`fa-solid ${doc.icone}`}></i>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-sm text-gray-900 dark:text-white">{doc.titre}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">{doc.description}</p>
                </div>
                <i className="fa-solid fa-chevron-right text-gray-300 dark:text-zinc-600 text-xs group-hover:translate-x-0.5 group-hover:text-emerald-500 transition-all"></i>
              </button>
            ))}
          </div>

          <div className="pt-2 border-t border-gray-100 dark:border-zinc-800/80">
            <Link
              href={safeRedirect}
              className="inline-block text-[12px] font-bold text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 uppercase tracking-wider transition-colors py-1"
            >
              Passer cette étape ›
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ChoixDocumentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAF6F1] dark:bg-zinc-950" />}>
      <ChoixDocumentContent />
    </Suspense>
  );
}
