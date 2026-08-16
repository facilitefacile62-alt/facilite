"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function AideCandidatureContent() {
  const searchParams = useSearchParams();
  const offreTitre = searchParams?.get("titre") || "cette offre d'emploi";
  const [isPlaying, setIsPlaying] = useState(false);
  const [btnClicked, setBtnClicked] = useState(false);

  const handleCliqueIci = () => {
    setBtnClicked(true);
  };

  return (
    <div className="min-h-screen bg-[#FAF6F1]/60 dark:bg-gray-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Navigation retour */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-extrabold text-gray-700 dark:text-gray-300 hover:text-emerald-600 transition p-2 rounded-xl hover:bg-white dark:hover:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-2xs cursor-pointer"
          >
            <i className="fa-solid fa-arrow-left"></i>
            <span>Retour aux offres</span>
          </Link>
          <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-full">
            Tutoriel & Aide
          </span>
        </div>

        {/* Carte Principale */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200/90 dark:border-gray-800 shadow-sm p-5 sm:p-8 space-y-6">
          
          {/* Titre & Sous-titre */}
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center text-xl mx-auto shadow-2xs">
              <i className="fa-solid fa-circle-play"></i>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              Vidéo d'explication pour postuler
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
              Regardez attentivement cette vidéo d'accompagnement pour réussir votre candidature pour{" "}
              <strong className="text-gray-900 dark:text-white font-bold">{offreTitre}</strong>.
            </p>
          </div>

          {/* Lecteur Vidéo d'Explication */}
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-gray-950 border border-gray-800 shadow-lg flex items-center justify-center group">
            {isPlaying ? (
              <iframe
                className="w-full h-full"
                src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1"
                title="Vidéo d'explication"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            ) : (
              <div
                onClick={() => setIsPlaying(true)}
                className="relative w-full h-full flex flex-col items-center justify-center cursor-pointer select-none"
              >
                {/* Poster d'arrière-plan */}
                <div className="absolute inset-0 bg-gradient-to-tr from-gray-950 via-gray-900 to-[#161d31] opacity-95"></div>
                
                {/* Motif décoratif d'ondes */}
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#10E688_1px,transparent_1px)] [background-size:16px_16px]"></div>

                {/* Bouton Play central animé */}
                <div className="relative z-10 flex flex-col items-center gap-3">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#10E688] hover:bg-[#0fd07b] text-gray-950 flex items-center justify-center text-2xl sm:text-3xl shadow-2xl transform group-hover:scale-110 transition-all duration-300">
                    <i className="fa-solid fa-play ml-1"></i>
                  </div>
                  <div className="text-center">
                    <p className="text-white font-black text-sm sm:text-base">Cliquez pour lancer la vidéo</p>
                    <p className="text-gray-400 text-xs font-medium">Durée : 2 min d'explication claire</p>
                  </div>
                </div>

                {/* Badge d'aide en bas à gauche */}
                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-xs text-white text-[11px] font-bold px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2">
                  <i className="fa-solid fa-lightbulb text-[#10E688]"></i>
                  <span>Astuces pour maximiser votre sélection</span>
                </div>
              </div>
            )}
          </div>

          {/* Touche / Bouton « Cliquez ici » sous la vidéo */}
          <div className="pt-2 flex flex-col items-center gap-3">
            <button
              type="button"
              id="btn-cliquez-ici"
              onClick={handleCliqueIci}
              className="w-full sm:w-auto min-w-[280px] py-4 px-8 bg-black hover:bg-gray-800 text-white font-black text-sm sm:text-base rounded-2xl shadow-xl hover:shadow-2xl transition transform active:scale-98 cursor-pointer flex items-center justify-center gap-3 border border-gray-700"
            >
              <i className="fa-solid fa-hand-pointer text-[#10E688] text-lg"></i>
              <span>Cliquez ici</span>
              <i className="fa-solid fa-arrow-right text-xs text-gray-400"></i>
            </button>

            {btnClicked && (
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                ✅ Action enregistrée ! En attente de vos instructions pour la suite.
              </p>
            )}

            <p className="text-[11px] text-gray-500 dark:text-gray-400 text-center font-medium">
              Besoin d'un accompagnement personnalisé ? Notre équipe reste à votre disposition 24/7.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}

export default function AideCandidaturePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FAF6F1]/60 dark:bg-gray-950">
          <i className="fa-solid fa-circle-notch fa-spin text-3xl text-emerald-600"></i>
        </div>
      }
    >
      <AideCandidatureContent />
    </Suspense>
  );
}
