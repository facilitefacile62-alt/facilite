import { supabase } from '@/lib/supabase';

// Connexion par code SMS (maquettes 43 « Connexion » et 44 « Code SMS »).
// Même mécanique que le site (src/components/PhoneAuthForm.jsx) :
// signInWithOtp puis verifyOtp de type « sms », en mode CONNEXION — jamais
// de création de compte (shouldCreateUser: false) : un numéro inconnu est
// refusé avec un message explicite, au lieu de créer un compte fantôme sans
// nom ni e-mail.

export const INDICATIF = '+221';
export const LONGUEUR_NUMERO = 9;
export const LONGUEUR_CODE = 6;
/** Délai avant de pouvoir redemander un SMS : chaque envoi a un coût réel. */
export const DELAI_RENVOI_S = 30;

/** Ne garde que les chiffres, sans indicatif ni zéro initial parasite. */
export function chiffresDuNumero(saisie: string): string {
  let chiffres = saisie.replace(/\D/g, '');
  if (chiffres.startsWith('221') && chiffres.length > LONGUEUR_NUMERO) chiffres = chiffres.slice(3);
  return chiffres.slice(0, LONGUEUR_NUMERO);
}

/** "771234567" -> "77 123 45 67", comme le placeholder « 77 000 00 00 ». */
export function formaterNumero(chiffres: string): string {
  const c = chiffres.slice(0, LONGUEUR_NUMERO);
  const morceaux = [c.slice(0, 2), c.slice(2, 5), c.slice(5, 7), c.slice(7, 9)];
  return morceaux.filter(Boolean).join(' ');
}

export function numeroComplet(chiffres: string): string {
  return `${INDICATIF}${chiffres}`;
}

export function numeroValide(chiffres: string): boolean {
  return chiffres.length === LONGUEUR_NUMERO;
}

function messageLisible(erreur: { message?: string; code?: string } | null, parDefaut: string): string {
  const msg = erreur?.message ?? '';
  if (/signups? not allowed/i.test(msg) || erreur?.code === 'otp_disabled') {
    return "Aucun compte n'est associé à ce numéro. Connectez-vous avec votre e-mail ou Google, puis ajoutez et vérifiez votre numéro depuis votre profil (Sécurité & Connexion).";
  }
  if (/only request this after|rate limit|too many/i.test(msg) || erreur?.code === 'over_sms_send_rate_limit') {
    return 'Trop de demandes. Patientez un instant avant de redemander un code.';
  }
  if (/expired|invalid/i.test(msg)) {
    return 'Code invalide ou expiré. Vérifiez-le ou demandez-en un nouveau.';
  }
  if (!msg || msg === '{}' || msg === '[object Object]') return parDefaut;
  return msg;
}

/**
 * Envoie le code. Renvoie null en cas de succès, sinon le message à afficher.
 *
 * Sans `creation` : mode CONNEXION, jamais de compte créé. Avec `creation` :
 * mode INSCRIPTION (onglet « Téléphone » de l'écran d'inscription) — le
 * compte est créé à la validation du code, avec le nom saisi. Un compte créé
 * par téléphone n'a aucun e-mail ; comme sur le site, l'e-mail n'est exigé
 * que pour candidater, pas pour créer le compte.
 */
export async function envoyerCodeSms(
  chiffres: string,
  creation?: { nomComplet: string }
): Promise<string | null> {
  const { error } = await supabase.auth.signInWithOtp({
    phone: numeroComplet(chiffres),
    options: creation
      ? { shouldCreateUser: true, data: { full_name: creation.nomComplet } }
      : { shouldCreateUser: false },
  });
  return error ? messageLisible(error, "Impossible d'envoyer le SMS. Vérifiez le numéro.") : null;
}

/** Vérifie le code. Renvoie null en cas de succès (la session est alors posée). */
export async function verifierCodeSms(chiffres: string, code: string): Promise<string | null> {
  const { error } = await supabase.auth.verifyOtp({
    phone: numeroComplet(chiffres),
    token: code.trim(),
    type: 'sms',
  });
  return error ? messageLisible(error, 'Erreur lors de la vérification du code. Réessayez.') : null;
}
