// Compétences d'EXEMPLE des anciens profils : jusqu'au 25/10/2026, la valeur par défaut de la colonne profiles.skills était ces trois compétences. 62 profils
// modifiés après leur création (donc non nettoyés, voir 20261025160000_nettoyage_valeurs_exemple_profils.sql) les portent encore sans que la personne les ait
// choisies. On les IGNORE là où elles comptent — recherche et fiche des candidats, mise en correspondance par l'IA, score de candidature — sans toucher aux données.
//
// Règle STRICTE : seule la liste EXACTE (ces trois textes, dans cet ordre, rien d'autre) est ignorée. Une vraie compétence « Gestion de projet » saisie seule, ou
// avec d'autres compétences (avant, après, ou à la place des deux autres), n'est jamais ignorée. Même règle côté base : public.competences_reelles().
export const COMPETENCES_EXEMPLE = ["Gestion de projet", "Développement Web", "Stratégie Digitale"];

/** Vrai si la liste est EXACTEMENT l'exemple (mêmes trois textes, même ordre). */
export function sontCompetencesExemple(skills) {
  return Array.isArray(skills) && skills.length === COMPETENCES_EXEMPLE.length && COMPETENCES_EXEMPLE.every((c, i) => skills[i] === c);
}

/** Les compétences réellement saisies : la liste telle quelle, sauf si c'est exactement l'exemple (alors liste vide). */
export function competencesReelles(skills) {
  return sontCompetencesExemple(skills) ? [] : skills;
}
