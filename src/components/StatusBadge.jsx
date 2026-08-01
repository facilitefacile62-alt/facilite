"use client";

// Badges de statut réutilisables, partagés entre le suivi de candidature
// (candidatures.status), les commandes (orders.payment_status) et le workflow
// d'accompagnement agent (agent_assignments.status) — les libellés qui se
// recoupent conceptuellement (ex: "pending") partagent la même entrée.
const STATUS_CONFIG = {
  pending: { label: "En attente", emoji: "🟡", className: "bg-amber-100 text-amber-800 border-amber-200" },
  reviewed: { label: "En revue", emoji: "🔎", className: "bg-purple-100 text-purple-800 border-purple-200" },
  interview_scheduled: { label: "Entretien programmé", emoji: "🎥", className: "bg-blue-100 text-blue-800 border-blue-200" },
  accepted: { label: "Retenu", emoji: "🟢", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  rejected: { label: "Non retenu", emoji: "🔴", className: "bg-red-100 text-red-800 border-red-200" },
  paid: { label: "Payé", emoji: "✅", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  failed: { label: "Échoué", emoji: "❌", className: "bg-red-100 text-red-800 border-red-200" },
  unassigned: { label: "Non assigné", emoji: "⚪", className: "bg-gray-100 text-gray-600 border-gray-200" },
  in_progress: { label: "En cours", emoji: "🔵", className: "bg-blue-100 text-blue-800 border-blue-200" },
  completed: { label: "Terminé", emoji: "✅", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
};

export default function StatusBadge({ status, className = "" }) {
  const config = STATUS_CONFIG[status] || {
    label: status || "Inconnu",
    emoji: "⚪",
    className: "bg-gray-100 text-gray-600 border-gray-200",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold border whitespace-nowrap ${config.className} ${className}`}
    >
      <span aria-hidden="true">{config.emoji}</span>
      <span>{config.label}</span>
    </span>
  );
}
