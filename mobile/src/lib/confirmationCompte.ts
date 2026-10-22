import { getQueryParams } from 'expo-auth-session/build/QueryParams';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';

// Confirmation du compte pour pouvoir postuler (page « Confirmer mon compte »).
// Les personnes inscrites avec leur seul numéro de téléphone n'ont pas d'adresse e-mail : on AJOUTE donc
// une adresse à leur compte existant (updateUser) — surtout pas signInWithOtp, qui créerait un second compte.
// Supabase envoie alors un code à 6 chiffres à cette adresse ; il se vérifie avec le type « email_change ».
//
// Dépendances du projet Supabase (tableau de bord, hors du code) : le modèle de courriel « Change Email
// Address » doit contenir le code ({{ .Token }}) ; pour « Continuer avec Google », l'option « Manual linking »
// (Authentication > Sign In / Providers) doit être activée.
export const LONGUEUR_CODE = 6;
export const DELAI_RENVOI_S = 45;
/** Blocage après ESSAIS_MAX codes faux (maquette « Trop d'essais », 10 minutes). */
export const BLOCAGE_ESSAIS_S = 600;
/** Au-delà de ce nombre de codes faux, on bloque la saisie le temps d'en redemander un. */
export const ESSAIS_MAX = 5;

export type ErreurConfirmation = { type: 'reseau' | 'limite' | 'incorrect' | 'expire' | 'email_pris' | 'autre'; message: string };

export function emailValide(saisie: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(saisie.trim());
}

function classer(erreur: { message?: string; code?: string; status?: number } | null, parDefaut: string): ErreurConfirmation {
  const msg = erreur?.message ?? '';
  if (/network|fetch|failed to|timeout|internet|connexion/i.test(msg) || erreur?.status === 0) {
    return { type: 'reseau', message: 'Pas de connexion internet' };
  }
  if (/rate limit|only request this after|too many/i.test(msg) || erreur?.code === 'over_email_send_rate_limit') {
    return { type: 'limite', message: 'Trop de demandes. Patientez un instant avant de redemander un code.' };
  }
  if (/already (been )?registered|already exists|email_exists/i.test(msg) || erreur?.code === 'email_exists') {
    return { type: 'email_pris', message: 'Cette adresse est déjà utilisée par un autre compte.' };
  }
  // Supabase répond « Token has expired or is invalid » (code otp_expired) pour un code faux ET pour un code
  // périmé, sans les distinguer : on affiche « incorrect », et le bouton « Renvoyer le code » règle les deux cas.
  if (/expired|invalid/i.test(msg) || erreur?.code === 'otp_expired') {
    return { type: 'incorrect', message: 'Code incorrect, réessayez.' };
  }
  return { type: 'autre', message: msg || parDefaut };
}

/** Envoie le code à l'adresse saisie. Renvoie null en cas de succès. */
export async function envoyerCodeConfirmation(email: string): Promise<ErreurConfirmation | null> {
  try {
    const { error } = await supabase.auth.updateUser({ email: email.trim().toLowerCase() });
    return error ? classer(error, "Impossible d'envoyer le code. Vérifiez l'adresse e-mail.") : null;
  } catch (e) {
    return classer({ message: e instanceof Error ? e.message : '' }, "Impossible d'envoyer le code.");
  }
}

/** Vérifie le code. Renvoie null en cas de succès (l'adresse est alors confirmée sur le compte). */
export async function verifierCodeConfirmation(email: string, code: string): Promise<ErreurConfirmation | null> {
  try {
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email_change' });
    if (error) return classer(error, 'Code incorrect, réessayez.');
    await supabase.auth.refreshSession().catch(() => {});
    return null;
  } catch (e) {
    return classer({ message: e instanceof Error ? e.message : '' }, 'Impossible de vérifier le code.');
  }
}

WebBrowser.maybeCompleteAuthSession();

/** Relie un compte Google au compte actuel (et confirme ainsi son adresse). Lève une erreur lisible en cas d'échec. */
export async function lierCompteGoogle(): Promise<void> {
  const redirectTo = Linking.createURL('auth/callback');
  const { data, error } = await supabase.auth.linkIdentity({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
  if (error) throw new Error(classer(error, 'La connexion avec Google a échoué.').message);
  if (!data?.url) throw new Error('La connexion avec Google a échoué.');

  const resultat = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (resultat.type !== 'success' || !('url' in resultat) || !resultat.url) throw new Error('La connexion avec Google a été annulée.');

  const { params, errorCode } = getQueryParams(resultat.url);
  if (errorCode) throw new Error('La connexion avec Google a échoué.');
  if (params.access_token && params.refresh_token) {
    const { error: erreurSession } = await supabase.auth.setSession({ access_token: params.access_token, refresh_token: params.refresh_token });
    if (erreurSession) throw new Error('La connexion avec Google a échoué.');
  }
  await supabase.auth.refreshSession().catch(() => {});
}
