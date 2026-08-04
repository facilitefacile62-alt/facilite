"use client";

import Link from "next/link";

const BADGE_INFO = {
  verified_recruiter: {
    emoji: "✅",
    label: "Recruteur vérifié",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  official_staff: {
    emoji: "🛡️",
    label: "Équipe Facilite",
    className: "bg-purple-100 text-purple-800 border-purple-200",
  },
  administrateur: {
    emoji: "🛡️",
    label: "ADMINISTRATEUR",
    className: "bg-red-100 text-red-800 border-red-200",
  },
};

export default function BadgeDisplay({ badges, size = "sm", className = "", clickable = false }) {
  if (!Array.isArray(badges) || badges.length === 0) return null;

  const sizeClass = size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1";

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {badges.map((badge) => {
        const info = BADGE_INFO[badge];
        if (!info) return null; // badge inconnu : affichage silencieusement ignoré plutôt que planter

        if ((badge === "verified_recruiter" || badge === "administrateur") && clickable) {
          const href = badge === "verified_recruiter" ? "/recruteur" : "/admin";
          const title = badge === "verified_recruiter" ? "Accéder au tableau de bord recruteur" : "Accéder au tableau de bord d'administration";
          return (
            <Link
              key={badge}
              href={href}
              className="cursor-pointer inline-flex"
              title={title}
            >
              <span
                className={`inline-flex items-center gap-1 rounded-full font-extrabold border ${info.className} ${sizeClass} transition hover:opacity-90 hover:scale-105 active:scale-95`}
              >
                <span aria-hidden="true">{info.emoji}</span>
                <span>{info.label}</span>
              </span>
            </Link>
          );
        }

        return (
          <span
            key={badge}
            className={`inline-flex items-center gap-1 rounded-full font-extrabold border ${info.className} ${sizeClass}`}
          >
            <span aria-hidden="true">{info.emoji}</span>
            <span>{info.label}</span>
          </span>
        );
      })}
    </div>
  );
}
