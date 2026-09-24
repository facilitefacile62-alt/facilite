/**
 * Choix d'univers (/bienvenue : « Facilité » ou « Facilité Business »).
 *
 * Il ne se fait qu'UNE fois, à la création du compte. Un compte qui l'a déjà
 * fait (repère `onboarding_done` posé dans ses métadonnées) ou qui existe
 * depuis plus de 7 jours n'y repasse jamais, quelle que soit la façon dont il
 * arrive sur la page (ancien lien, connexion Google, favori…).
 *
 * Signalé le 24/09/2026 : un ancien utilisateur, avec boutique, revoyait ce
 * choix puis « Visiteur / Vendeur » à chaque connexion.
 */
export const JOURS_COMPTE_ANCIEN = 7;

/** true si ce compte n'a plus à voir le choix d'univers. */
export function choixDejaFait(utilisateur, maintenantMs = Date.now()) {
  if (!utilisateur) return false;
  if (utilisateur.user_metadata?.onboarding_done === true) return true;
  const cree = utilisateur.created_at ? new Date(utilisateur.created_at).getTime() : 0;
  return cree > 0 && maintenantMs - cree > JOURS_COMPTE_ANCIEN * 24 * 3600 * 1000;
}
