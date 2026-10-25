import { DELAI_RENVOI_S, messageErreurCode, messageErreurEnvoi } from '@/lib/messagesCode';
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
export const DELAI_RENVOI_EMAIL_S = DELAI_RENVOI_S;

export function emailValide(saisie: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(saisie.trim());
}

/** Envoie le code. Renvoie null en cas de succès, sinon le message à afficher. */
export async function envoyerCodeEmail(email: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  });
  return error ? messageErreurEnvoi(error) : null;
}

/** Vérifie le code. Renvoie null en cas de succès (la session est alors posée). */
export async function verifierCodeEmail(email: string, code: string, envoyeLe?: number | null): Promise<string | null> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'email',
  });
  return error ? messageErreurCode(error, envoyeLe) : null;
}
