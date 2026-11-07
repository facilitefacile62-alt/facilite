"use client";

import { useEffect, useState } from "react";

// Orbe bleu lumineux de l'aide : CSS pur (dégradés radiaux), aucune bibliothèque, aucune image lourde.
//  - <OrbeGrande /> vit DANS le panneau, au-dessus de la discussion, avec un halo doux et une respiration légère ;
//  - le défaut (export par défaut) est la MINIATURE de l'orbe, icône ronde de la pastille « Aide » du menu « + ».
// La respiration et les transitions sont coupées si la personne demande moins de mouvement ou si l'appareil est
// modeste (peu de mémoire / peu de cœurs) : l'orbe reste alors fixe, tout aussi lumineux.
function appareilModeste() {
  if (typeof navigator === "undefined") return false;
  const memoire = Number(navigator.deviceMemory);
  const coeurs = Number(navigator.hardwareConcurrency);
  return (Number.isFinite(memoire) && memoire > 0 && memoire <= 2) || (Number.isFinite(coeurs) && coeurs > 0 && coeurs <= 2);
}

/** true quand l'animation est permise (mouvement non réduit et appareil non modeste). */
export function useMouvement() {
  const [animer, setAnimer] = useState(false);
  useEffect(() => {
    const requete = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const maj = () => setAnimer(!requete?.matches && !appareilModeste());
    maj();
    requete?.addEventListener?.("change", maj);
    return () => requete?.removeEventListener?.("change", maj);
  }, []);
  return animer;
}

function StylesOrbe() {
  return (
    <style>{`
      @keyframes aide-respire { 0%,100% { transform: scale(1); opacity: .85; } 50% { transform: scale(1.08); opacity: 1; } }
      .aide-bille { background:
          radial-gradient(circle at 34% 28%, rgba(255,255,255,.95) 0 6%, rgba(190,225,255,.75) 14%, rgba(255,255,255,0) 34%),
          radial-gradient(circle at 50% 56%, #4aa3ff 0%, #1f6fe8 48%, #0b3fae 78%, #072a78 100%); }
      .aide-halo { background: radial-gradient(circle, rgba(70,150,255,.5) 0%, rgba(70,150,255,.22) 38%, rgba(70,150,255,0) 68%); }
      .aide-halo--anime { animation: aide-respire 3.6s ease-in-out infinite; }
      .aide-orbe-taille--anime { transition: width .35s ease, height .35s ease; }
      .aide-orbe-taille--anime .aide-halo, .aide-orbe-taille--anime .aide-bille { transition: inset .35s ease; }
    `}</style>
  );
}

/** Grande orbe du panneau. `petit` : taille réduite (la transition est douce, et supprimée si mouvement réduit). */
export function OrbeGrande({ petit = false, taille, animer = false }) {
  const t = taille ?? (petit ? 48 : 104);
  return (
    <>
      <StylesOrbe />
      <div
        aria-hidden="true"
        data-orbe-taille={petit ? "petit" : "grand"}
        className={`relative shrink-0 ${animer ? "aide-orbe-taille--anime" : ""}`}
        style={{ width: t, height: t }}
      >
        <span className={`aide-halo absolute rounded-full pointer-events-none ${animer ? "aide-halo--anime" : ""}`} style={{ inset: "-18%" }} />
        <span className="aide-bille absolute inset-0 rounded-full border border-white/50" />
      </div>
    </>
  );
}

/** Miniature de l'orbe : icône ronde (32 px) de la pastille « Aide » du menu « + », comme les icônes d'« Écrire un e-mail » et d'« Extracteur ». */
export default function PuceOrbe() {
  return (
    <>
      <StylesOrbe />
      <span className="relative w-8 h-8 rounded-full shrink-0 inline-block" aria-hidden="true">
        <span className="aide-halo absolute rounded-full pointer-events-none" style={{ inset: "-22%" }} />
        <span className="aide-bille absolute inset-0 rounded-full border border-white/60 shadow-md" />
      </span>
    </>
  );
}
