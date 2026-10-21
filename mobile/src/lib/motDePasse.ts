import { numeroComplet } from '@/lib/connexionSms';
import { supabase } from '@/lib/supabase';

// Mot de passe FACULTATIF (choix du 21/10/2026) : la connexion normale reste « numéro ou e-mail + code ». Le mot de passe sert
// de secours quand le code n'arrive pas (comme sur WhatsApp), par exemple sur un nouveau téléphone.
export const LONGUEUR_MIN_MOT_DE_PASSE = 6;

/** Enregistre un mot de passe sur le compte connecté. Renvoie un message d'erreur, ou null si tout va bien. */
export async function definirMotDePasse(motDePasse: string): Promise<string | null> {
  const { error } = await supabase.auth.updateUser({ password: motDePasse });
  if (!error) return null;
  if (/same|different from the old/i.test(error.message)) return 'Choisis un mot de passe différent de l’ancien.';
  if (/weak|short|at least/i.test(error.message)) return `Le mot de passe doit contenir au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`;
  return 'Impossible d’enregistrer le mot de passe pour le moment. Réessaie.';
}

/** Connexion par mot de passe, avec le numéro (9 chiffres sans indicatif) ou l'e-mail. Renvoie un message d'erreur, ou null. */
export async function seConnecterParMotDePasse(
  identifiant: { telephone: string } | { email: string },
  motDePasse: string
): Promise<string | null> {
  const { error } =
    'telephone' in identifiant
      ? await supabase.auth.signInWithPassword({ phone: numeroComplet(identifiant.telephone), password: motDePasse })
      : await supabase.auth.signInWithPassword({ email: identifiant.email.trim().toLowerCase(), password: motDePasse });
  if (!error) return null;
  if (/invalid login|credentials/i.test(error.message)) {
    return 'Mot de passe incorrect, ou aucun mot de passe n’a été créé pour ce compte. Utilise le code.';
  }
  return 'Connexion impossible pour le moment. Réessaie.';
}
