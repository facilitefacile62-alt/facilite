// Affichage du type de contrat d'une offre. Logique pure : la donnée n'est jamais modifiée, seul le texte affiché change.
// Un contrat vide (ou déjà écrit « Non spécifié ») s'affiche « Contrat non précisé », au lieu d'un blanc, d'un « Non spécifié » ou d'un « CDI » supposé.

export const CONTRAT_NON_PRECISE = "Contrat non précisé";

const NON_PRECISE = /^(?:non\s+sp[ée]cifi[ée]e?|contrat\s+non\s+pr[ée]cis[ée])$/i;

/** Le contrat est-il renseigné (ni vide, ni « Non spécifié », ni « Contrat non précisé ») ? */
export function contratEstPrecise(valeur) {
  const t = typeof valeur === "string" ? valeur.trim() : "";
  return t !== "" && !NON_PRECISE.test(t);
}

/** Texte à afficher pour le contrat : la valeur renseignée (sans espaces superflus), sinon « Contrat non précisé ». */
export function libelleContrat(valeur) {
  return contratEstPrecise(valeur) ? valeur.trim() : CONTRAT_NON_PRECISE;
}
