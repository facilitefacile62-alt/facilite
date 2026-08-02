"use client";

// Affichage cosmétique de public.profiles.badges — jamais une source
// d'autorisation (voir docs/audit-securite-2026-08.md et les migrations
// RBAC : aucune policy RLS ne lit cette colonne pour décider d'un droit).

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
};

export default function BadgeDisplay({ badges, size = "sm", className = "" }) {
  if (!Array.isArray(badges) || badges.length === 0) return null;

  const sizeClass = size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1";

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {badges.map((badge) => {
        const info = BADGE_INFO[badge];
        if (!info) return null; // badge inconnu : affichage silencieusement ignoré plutôt que planter
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
