// Statuts d'une candidature (colonne candidatures.status), avec les libellés vus par le recruteur et par le candidat.
// Parcours : Nouveau → Vu → Présélectionné → Entretien → Retenu / Refusé. « contacted » est un ancien statut, affiché tel quel.

export const STATUTS_CANDIDATURE = [
  { valeur: "pending", recruteur: "Nouveau", candidat: "Envoyée", classe: "bg-amber-100 text-amber-800 border-amber-200" },
  { valeur: "viewed", recruteur: "Vu", candidat: "Vue par le recruteur", classe: "bg-sky-100 text-sky-800 border-sky-200" },
  { valeur: "reviewed", recruteur: "Présélectionné", candidat: "Présélectionnée", classe: "bg-purple-100 text-purple-800 border-purple-200" },
  { valeur: "contacted", recruteur: "Contacté", candidat: "Contactée", classe: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { valeur: "interview_scheduled", recruteur: "Entretien", candidat: "Entretien programmé", classe: "bg-blue-100 text-blue-800 border-blue-200" },
  { valeur: "accepted", recruteur: "Retenu", candidat: "Retenue", classe: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { valeur: "rejected", recruteur: "Refusé", candidat: "Non retenue", classe: "bg-red-100 text-red-800 border-red-200" },
];

/** Statuts que le recruteur peut choisir (l'ancien « contacted » n'est plus proposé). */
export const STATUTS_CHOISISSABLES = STATUTS_CANDIDATURE.filter((s) => s.valeur !== "contacted");

export function infoStatut(valeur) {
  return (
    STATUTS_CANDIDATURE.find((s) => s.valeur === valeur) || {
      valeur,
      recruteur: valeur || "Inconnu",
      candidat: valeur || "Inconnu",
      classe: "bg-gray-100 text-gray-600 border-gray-200",
    }
  );
}
