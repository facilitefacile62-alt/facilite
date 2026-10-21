import { supabase } from '@/lib/supabase';

// Connexion par e-mail avec un code à 6 chiffres (écrans 09 à 14). Même
// principe que le code SMS : signInWithOtp puis verifyOtp (type « email »).
// Si l'adresse n'a pas encore de compte, il est créé à la validation du code ;
// la page « Nom et prénom » s'affiche alors une seule fois.
//
// Dépendance serveur : le courriel « Magic Link » du projet Supabase doit
// contenir le code ({{ .Token }}), pas seulement le lien — réglage du tableau
// de bord Supabase (Authentication > Email Templates), hors du code de l'app.

export const LONGUEUR_CODE_EMAIL = 6;
export const DELAI_RENVOI_EMAIL_S = 60;

export function emailValide(saisie: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(saisie.trim());
}

function messageLisible(erreur: { message?: string; code?: string } | null, parDefaut: string): string {
  const msg = erreur?.message ?? '';
  if (/rate limit|only request this after|too many/i.test(msg) || erreur?.code === 'over_email_send_rate_limit') {
    return 'Trop de demandes. Patientez un instant avant de redemander un code.';
  }
  if (/expired|invalid/i.test(msg)) return 'Code invalide ou expiré. Vérifie-le ou demande-en un nouveau.';
  return msg || parDefaut;
}

/** Envoie le code. Renvoie null en cas de succès, sinon le message à afficher. */
export async function envoyerCodeEmail(email: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  });
  return error ? messageLisible(error, "Impossible d'envoyer le code. Vérifie l'adresse e-mail.") : null;
}

/** Vérifie le code. Renvoie null en cas de succès (la session est alors posée). */
export async function verifierCodeEmail(email: string, code: string): Promise<string | null> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'email',
  });
  return error ? messageLisible(error, 'Code invalide ou expiré.') : null;
}
