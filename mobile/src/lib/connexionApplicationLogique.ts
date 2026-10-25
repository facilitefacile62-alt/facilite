// Connexion dans l'application (première version Android) : messages d'erreur NEUTRES, en français, jamais de texte technique anglais. Logique PURE, sans import.
//
// Règle de confidentialité : un refus de connexion ne dit jamais si une adresse e-mail existe, ni si elle est confirmée. Un seul message pour « adresse inconnue »,
// « mot de passe faux » et « adresse non confirmée ». Seule une panne de réseau a son propre message (elle ne révèle rien sur le compte).

export const MESSAGE_CONNEXION_REFUSEE = 'Adresse e-mail ou mot de passe incorrect. Vérifiez et réessayez.';
export const MESSAGE_RESEAU = 'Connexion impossible pour le moment. Vérifiez votre réseau et réessayez.';
export const MESSAGE_GOOGLE_ECHEC = 'La connexion avec Google a échoué. Réessayez.';
/** Messages français déjà écrits par l'application (oauth.ts) : les seuls qu'on affiche tels quels pour Google. */
export const MESSAGES_GOOGLE_CONNUS = ['Connexion annulée.', 'Réponse Google incomplète.', 'Impossible de démarrer la connexion Google.'];

type ErreurAuth = { message?: string; name?: string; status?: number } | null | undefined;

const estPanneReseau = (e: ErreurAuth): boolean =>
  e?.name === 'AuthRetryableFetchError' || e?.status === 0 || /network request failed|failed to fetch|timeout|timed out/i.test(String(e?.message ?? ''));

/** Message à afficher quand la connexion par e-mail et mot de passe est refusée. */
export function messageRefusConnexion(erreur: ErreurAuth): string {
  return estPanneReseau(erreur) ? MESSAGE_RESEAU : MESSAGE_CONNEXION_REFUSEE;
}

/** Message à afficher quand « Continuer avec Google » échoue : un de nos messages français connus, sinon un message générique. */
export function messageErreurGoogle(erreur: unknown): string {
  const texte = erreur instanceof Error ? erreur.message : '';
  return MESSAGES_GOOGLE_CONNUS.includes(texte) ? texte : MESSAGE_GOOGLE_ECHEC;
}
