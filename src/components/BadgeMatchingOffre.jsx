"use client";

// Badge de correspondance candidat <-> offre, réutilisé par HomeClient.jsx,
// OffresClient.jsx et candidat/page.js — jusqu'ici, chacun redessinait ce
// badge à la main (styles légèrement différents selon le fichier). Le style
// "pilule" (fond emerald-50, bordure) reprend celui déjà en place dans
// candidat/page.js ("Offres recommandées pour toi"), le plus visible des
// trois versions existantes.
//
// Seuil à 75% : au-delà, le badge passe en "Recommandé pour vous" plutôt
// que le simple pourcentage — distinction demandée explicitement, pas une
// invention. Le score lui-même n'est PAS recalculé ici : il vient du RPC
// match_job_offers existant (voir src/lib/useCandidateMatchScores.js),
// aucun nouvel algorithme.
export const SEUIL_RECOMMANDATION = 0.75;

/**
 * @param {{ score: number|null|undefined, className?: string }} props
 * score : similarité 0..1 (jamais un pourcentage déjà arrondi).
 */
export default function BadgeMatchingOffre({ score, className = "" }) {
  if (score == null) return null;

  const pourcentage = Math.round(score * 100);
  const recommande = score >= SEUIL_RECOMMANDATION;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border whitespace-nowrap ${
        recommande
          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-[#10E688] dark:border-emerald-900"
          : "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700"
      } ${className}`}
    >
      <i className="fa-solid fa-user-check text-[9px]" aria-hidden="true"></i>
      {recommande ? `Recommandé pour vous · ${pourcentage}%` : `${pourcentage}% compatible`}
    </span>
  );
}
