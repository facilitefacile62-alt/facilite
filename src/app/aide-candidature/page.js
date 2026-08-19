"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getFaciliteWhatsAppUrl } from "@/lib/whatsappHelp";

function AideCandidatureContent() {
  const searchParams = useSearchParams();
  const offreTitre = searchParams?.get("titre") || "Recrutement spécial — Enseignement & Fonction Publique";
  const offreLien = searchParams?.get("lien") || "";
  const [isPlaying, setIsPlaying] = useState(false);
  const [btnClicked, setBtnClicked] = useState(false);

  const handleAction = () => {
    setBtnClicked(true);
    if (offreLien && (offreLien.startsWith("http://") || offreLien.startsWith("https://"))) {
      window.open(offreLien, "_blank");
    } else {
      setIsPlaying(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6F1]/50 dark:bg-gray-950 py-6 px-4 sm:px-6 flex flex-col justify-start">
      <div className="w-full max-w-md mx-auto space-y-4">
        
        {/* Navigation retour & Badge (1:1 avec la capture) */}
        <div className="flex items-center justify-between">
          <Link
            href="/offres"
            className="inline-flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 hover:text-gray-900 transition font-medium"
          >
            <i className="fa-solid fa-arrow-left text-xs"></i>
            <span className="underline">Retour aux offres</span>
          </Link>
          <span className="text-xs font-bold px-3 py-1 bg-[#dcfce7] text-[#166534] dark:bg-green-950/70 dark:text-green-300 rounded-full">
            Tutoriel et aide
          </span>
        </div>

        {/* Carte Principale */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200/90 dark:border-gray-800 p-5 sm:p-6 space-y-4 shadow-2xs">
          
          {/* Header de la carte : Icône Play verte + Titre aligné à gauche */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#dcfce7] text-[#166534] flex items-center justify-center text-sm font-bold flex-shrink-0">
              <i className="fa-solid fa-play ml-0.5"></i>
            </div>
            <h1 className="text-base sm:text-lg font-black text-gray-900 dark:text-white tracking-tight leading-snug">
              Vidéo d'explication pour postuler
            </h1>
          </div>

          {/* Description */}
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-normal leading-relaxed">
            Regardez cette courte vidéo pour réussir votre candidature à{" "}
            <strong className="font-extrabold text-gray-900 dark:text-white">{offreTitre}</strong>.
          </p>

          {/* Cadre Lecteur Vidéo */}
          <div className="relative w-full aspect-[16/10] rounded-2xl overflow-hidden bg-gray-50 dark:bg-gray-800/40 border border-gray-150 dark:border-gray-800 flex items-center justify-center group">
            {isPlaying ? (
              <iframe
                className="w-full h-full"
                src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1"
                title="Vidéo d'explication"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              ></iframe>
            ) : (
              <div
                onClick={() => setIsPlaying(true)}
                className="relative w-full h-full flex items-center justify-center cursor-pointer select-none"
              >
                {/* Badge durée 2 min en haut à droite */}
                <div className="absolute top-3 right-3 bg-gray-600/90 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full z-10 shadow-xs">
                  2 min
                </div>

                {/* Bouton Play Vert Central */}
                <div className="w-14 h-14 rounded-full bg-[#009639] hover:bg-[#008030] text-black flex items-center justify-center text-xl shadow-md transform group-hover:scale-105 transition duration-200">
                  <i className="fa-solid fa-play ml-1 text-white text-base"></i>
                </div>
              </div>
            )}
          </div>

          {/* Sous-texte : Astuces pour maximiser votre sélection */}
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Astuces pour maximiser votre sélection
          </p>

          {/* Bouton : Regarder puis continuer -> */}
          <button
            type="button"
            id="btn-regarder-continuer"
            onClick={handleAction}
            className="w-full py-3.5 px-6 bg-black hover:bg-gray-900 active:scale-98 text-white font-extrabold text-sm rounded-2xl shadow-sm flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <span>{offreLien ? "Postuler sur le site officiel" : "Regarder puis continuer"}</span>
            <i className="fa-solid fa-arrow-right text-xs"></i>
          </button>

          {btnClicked && (
            <p className="text-xs font-bold text-emerald-600 text-center animate-in fade-in">
              ✅ Redirection en cours...
            </p>
          )}

        </div>

        {/* Assistance Directe WhatsApp */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#25D366] text-white flex items-center justify-center text-xl shadow-xs shrink-0">
              <i className="fa-brands fa-whatsapp"></i>
            </div>
            <div>
              <h4 className="text-xs font-black text-gray-900 dark:text-white leading-tight">Accompagnement Facilité</h4>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">Envoyez un message à Facilité sur WhatsApp</p>
            </div>
          </div>
          <a
            href={getFaciliteWhatsAppUrl({ offerTitle: offreTitre, offerId: offreLien })}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-4 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-black rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0"
          >
            <i className="fa-brands fa-whatsapp text-sm"></i>
            <span>WhatsApp (+221 77 140 08 32)</span>
          </a>
        </div>

        {/* Footer d'assistance */}
        <div className="flex items-center justify-between pt-1 px-1 text-xs text-gray-600 dark:text-gray-400 font-medium">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-headset text-gray-500 text-sm"></i>
            <span>Besoin d'un accompagnement personnalisé ?</span>
          </div>
          <a
            href={getFaciliteWhatsAppUrl({ offerTitle: offreTitre, offerId: offreLien })}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 hover:text-emerald-700 underline font-bold whitespace-nowrap ml-2"
          >
            Nous contacter
          </a>
        </div>

      </div>
    </div>
  );
}

export default function AideCandidaturePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FAF6F1]/50 dark:bg-gray-950">
          <i className="fa-solid fa-circle-notch fa-spin text-3xl text-emerald-600"></i>
        </div>
      }
    >
      <AideCandidatureContent />
    </Suspense>
  );
}
