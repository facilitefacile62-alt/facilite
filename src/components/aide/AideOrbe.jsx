"use client";

import { useEffect, useState } from "react";

// Orbe bleu lumineux du bouton « Aide » : CSS pur (dégradés radiaux), aucune bibliothèque, aucune image
// lourde. L'animation de respiration est coupée si la personne demande moins de mouvement ou si l'appareil
// est modeste (peu de mémoire / peu de cœurs) : l'orbe reste alors fixe, tout aussi lumineux.
function appareilModeste() {
  if (typeof navigator === "undefined") return false;
  const memoire = Number(navigator.deviceMemory);
  const coeurs = Number(navigator.hardwareConcurrency);
  return (Number.isFinite(memoire) && memoire > 0 && memoire <= 2) || (Number.isFinite(coeurs) && coeurs > 0 && coeurs <= 2);
}

export default function AideOrbe({ ouvert, onClick }) {
  const [animer, setAnimer] = useState(false);

  useEffect(() => {
    const reduit = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setAnimer(!reduit && !appareilModeste());
  }, []);

  return (
    <>
      <style>{`
        @keyframes aide-respire { 0%,100% { transform: scale(1); box-shadow: 0 0 22px 4px rgba(56,140,255,.55), 0 0 48px 10px rgba(56,140,255,.25); }
                                  50%     { transform: scale(1.05); box-shadow: 0 0 30px 8px rgba(86,170,255,.7), 0 0 64px 16px rgba(56,140,255,.32); } }
        .aide-orbe { background:
            radial-gradient(circle at 34% 28%, rgba(255,255,255,.95) 0 6%, rgba(190,225,255,.75) 14%, rgba(255,255,255,0) 34%),
            radial-gradient(circle at 50% 56%, #4aa3ff 0%, #1f6fe8 48%, #0b3fae 78%, #072a78 100%);
          box-shadow: 0 0 22px 4px rgba(56,140,255,.55), 0 0 48px 10px rgba(56,140,255,.25); }
        .aide-orbe--anime { animation: aide-respire 3.4s ease-in-out infinite; }
      `}</style>
      <button
        type="button"
        onClick={onClick}
        aria-label={ouvert ? "Fermer l'aide" : "Ouvrir l'aide : questions fréquentes, assistant et équipe Facilité"}
        aria-expanded={ouvert}
        aria-haspopup="dialog"
        className={`aide-orbe ${animer ? "aide-orbe--anime" : ""} w-16 h-16 rounded-full border border-white/40 cursor-pointer flex items-center justify-center text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300`}
      >
        <span className="sr-only">Aide</span>
        {ouvert ? <i className="fa-solid fa-xmark text-xl" aria-hidden="true"></i> : null}
      </button>
    </>
  );
}
