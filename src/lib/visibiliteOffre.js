// Qui peut voir la fiche d'une offre NON VALIDÉE (en attente de modération, refusée, brouillon) ? Logique pure.
//
// La règle de lecture publique de la base ne laisse voir que les offres approuvées (status = 'approved'). La fiche /offres/<id> lit pourtant l'offre avec la clé
// serveur, qui ignore cette règle : sans garde-fou, n'importe quel visiteur disposant du lien pouvait ouvrir une offre non validée, avec ses contacts. Ici :
//  - une offre validée (ou sans statut : offres de secours) reste visible de tous, comme avant ;
//  - une offre non validée n'est visible que de son propriétaire et d'un administrateur connectés ; pour tout autre visiteur, la page répond 404.
// (La page porte de plus « noindex » et n'est jamais dans le plan du site, voir offreHorsReferencement.)

/** L'offre est-elle validée ? Pas de statut = validée (offres de secours codées en dur). */
export function offreValidee(offre) {
  return !offre?.status || offre.status === "approved";
}

/** Le visiteur ({ userId, estAdmin }) peut-il voir cette offre non validée ? Propriétaire (recruiter_id) ou administrateur connecté seulement. */
export function peutVoirOffreNonValidee({ recruteurId, visiteur } = {}) {
  if (!visiteur?.userId) return false;
  return visiteur.estAdmin === true || (Boolean(recruteurId) && visiteur.userId === recruteurId);
}
