"use client";

// candidat/recruteur/agent : conservés comme libellés décoratifs pour les
// espaces /candidat et /recruteur (accessibles à tout rôle "user" depuis le
// chantier RBAC — ce ne sont plus des rôles de compte réels, juste des
// espaces produit). user/publisher/admin : les rôles réels de
// public.user_roles, utilisés partout où ce composant reçoit une valeur
// venue de la base plutôt qu'un libellé statique codé en dur dans le JSX.
const BADGES = {
  candidat: { emoji: "🟢", label: "Candidat", className: "bg-emerald-100 text-emerald-800" },
  recruteur: { emoji: "💼", label: "Recruteur", className: "bg-blue-100 text-blue-800" },
  user: { emoji: "🟢", label: "Utilisateur", className: "bg-emerald-100 text-emerald-800" },
  publisher: { emoji: "🎧", label: "Éditeur", className: "bg-amber-100 text-amber-800" },
  admin: { emoji: "🛡️", label: "Admin", className: "bg-purple-100 text-purple-800" },
  agent: { emoji: "🎧", label: "Agent", className: "bg-amber-100 text-amber-800" },
};

export default function RoleBadge({ role, className = "" }) {
  const badge = BADGES[role] || BADGES.user;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${badge.className} ${className}`}
    >
      <span aria-hidden="true">{badge.emoji}</span>
      <span>{badge.label}</span>
    </span>
  );
}
