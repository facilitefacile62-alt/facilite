// Logique pure (aucun import) de la récupération du mot de passe dans l'app : lecture du lien reçu par e-mail,
// validation du nouveau mot de passe, traduction des erreurs. Séparée de l'écran pour être testée sans l'app.

export const LONGUEUR_MIN_MDP = 8;

export type LienRecuperation = {
  accessToken: string | null;
  refreshToken: string | null;
  /** Flux PKCE : code à échanger contre une session. */
  code: string | null;
  /** Le lien porte une erreur (le plus souvent : lien expiré ou déjà utilisé). */
  erreur: 'expire' | 'invalide' | null;
};

function lireParametres(morceau: string): Record<string, string> {
  const resultat: Record<string, string> = {};
  for (const paire of morceau.split('&')) {
    if (!paire) continue;
    const i = paire.indexOf('=');
    const cle = decodeURIComponent((i < 0 ? paire : paire.slice(0, i)).replace(/\+/g, ' '));
    const valeur = i < 0 ? '' : decodeURIComponent(paire.slice(i + 1).replace(/\+/g, ' '));
    resultat[cle] = valeur;
  }
  return resultat;
}

/** Extrait jetons, code ou erreur du lien ouvert (paramètres après « # » ou après « ? »). */
export function lireLienRecuperation(url: string | null | undefined): LienRecuperation {
  const vide: LienRecuperation = { accessToken: null, refreshToken: null, code: null, erreur: null };
  if (!url) return vide;
  const iDiese = url.indexOf('#');
  const sansDiese = iDiese < 0 ? url : url.slice(0, iDiese);
  const iPoint = sansDiese.indexOf('?');
  let params: Record<string, string> = {};
  try {
    if (iPoint >= 0) params = { ...params, ...lireParametres(sansDiese.slice(iPoint + 1)) };
    if (iDiese >= 0) params = { ...params, ...lireParametres(url.slice(iDiese + 1)) };
  } catch {
    return { ...vide, erreur: 'invalide' };
  }
  if (params.error || params.error_code || params.error_description) {
    const brut = `${params.error_code ?? ''} ${params.error_description ?? ''}`.toLowerCase();
    return { ...vide, erreur: brut.includes('expired') || brut.includes('otp_expired') ? 'expire' : 'invalide' };
  }
  return {
    accessToken: params.access_token || null,
    refreshToken: params.refresh_token || null,
    code: params.code || null,
    erreur: null,
  };
}

/** Le lien contient-il de quoi ouvrir une session de récupération ? */
export function lienExploitable(lien: LienRecuperation): boolean {
  return !lien.erreur && ((Boolean(lien.accessToken) && Boolean(lien.refreshToken)) || Boolean(lien.code));
}

/** Message d'erreur (français) ou null si le nouveau mot de passe est valide. */
export function verifierNouveauMotDePasse(motDePasse: string, confirmation: string): string | null {
  if (motDePasse.length < LONGUEUR_MIN_MDP) return `Le mot de passe doit contenir au moins ${LONGUEUR_MIN_MDP} caractères.`;
  if (motDePasse !== confirmation) return 'Les mots de passe ne correspondent pas.';
  return null;
}

/** Traduit l'erreur de Supabase lors de l'enregistrement du nouveau mot de passe. */
export function messageErreurMiseAJour(message: string | null | undefined): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('different from the old') || m.includes('same as the old')) {
    return "Choisissez un mot de passe différent de l'ancien.";
  }
  if (m.includes('weak') || m.includes('at least') || m.includes('should contain')) {
    return 'Ce mot de passe est trop simple. Ajoutez des chiffres ou des lettres différentes.';
  }
  if (m.includes('session') || m.includes('jwt') || m.includes('not authenticated') || m.includes('expired')) {
    return 'Le lien a expiré. Demandez un nouveau lien de réinitialisation.';
  }
  return "Impossible d'enregistrer le mot de passe. Réessayez.";
}

/** Changement d'un mot de passe EXISTANT : l'ancien est exigé. Message d'erreur (français) ou null. */
export function verifierChangementMotDePasse(actuel: string, nouveau: string, confirmation: string): string | null {
  if (!actuel) return 'Veuillez saisir votre mot de passe actuel.';
  const probleme = verifierNouveauMotDePasse(nouveau, confirmation);
  if (probleme) return probleme;
  if (nouveau === actuel) return "Choisissez un mot de passe différent de l'ancien.";
  return null;
}
