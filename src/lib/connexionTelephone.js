// Connexion par code SMS — phrases et règles COMMUNES au site, à Facilité et à Locaux (l'application a une copie identique de ces textes dans
// mobile/src/lib/messagesCode.ts ; un test vérifie qu'elles restent les mêmes). Phrases très courtes, pour des personnes qui lisent peu.

/** Attente avant de pouvoir redemander un code : chaque envoi coûte, et plusieurs codes à la suite s'annulent entre eux. */
export const DELAI_RENVOI_S = 60;
/** Au-delà de ce délai après l'envoi, un code refusé est dit « expiré » (Supabase répond la même chose pour un code faux et un code expiré). */
export const EXPIRATION_CODE_MS = 10 * 60 * 1000;

export const MESSAGE_CODE_INVALIDE = "Ce code n'est pas bon. Vérifiez et réessayez.";
export const MESSAGE_CODE_EXPIRE = "Ce code a expiré. Demandez-en un nouveau.";
export const MESSAGE_CODE_TARDE = "Le code peut mettre quelques minutes à arriver. Ne demandez pas plusieurs codes.";
export const MESSAGE_TROP_DE_DEMANDES = "Trop de demandes. Attendez un peu avant de réessayer.";
export const MESSAGE_ENVOI_IMPOSSIBLE = "Le code n'a pas pu partir. Vérifiez le numéro et réessayez.";
export const MESSAGE_NUMERO_INCONNU = "Aucun compte avec ce numéro. Essayez avec votre e-mail.";
export const LIBELLE_RENVOYER = "Renvoyer le code";
export const LIBELLE_UTILISER_EMAIL = "Utiliser mon e-mail à la place";

const texteErreur = (erreur) => (typeof erreur === "string" ? erreur : (erreur && (erreur.message || erreur.error_description || erreur.msg)) || "");
const limiteDemandes = (erreur) => /only request this after|rate limit|too many/i.test(texteErreur(erreur)) || erreur?.code === "over_sms_send_rate_limit" || erreur?.code === "over_email_send_rate_limit";

/** Message à montrer quand l'ENVOI du code échoue : jamais de texte technique (Twilio, configuration…). */
export function messageErreurEnvoi(erreur) {
  if (/signups? not allowed/i.test(texteErreur(erreur)) || erreur?.code === "otp_disabled") return MESSAGE_NUMERO_INCONNU;
  if (limiteDemandes(erreur)) return MESSAGE_TROP_DE_DEMANDES;
  return MESSAGE_ENVOI_IMPOSSIBLE;
}

/** Message à montrer quand la VÉRIFICATION du code échoue : « pas bon » ou « expiré » (selon le temps écoulé depuis l'envoi). */
export function messageErreurCode(erreur, envoyeLe, maintenant = Date.now()) {
  if (limiteDemandes(erreur)) return MESSAGE_TROP_DE_DEMANDES;
  return Number.isFinite(envoyeLe) && maintenant - envoyeLe >= EXPIRATION_CODE_MS ? MESSAGE_CODE_EXPIRE : MESSAGE_CODE_INVALIDE;
}

/** Texte du bouton « renvoyer » avec son compte à rebours visible. */
export const libelleRenvoi = (secondesRestantes) => (secondesRestantes > 0 ? `${LIBELLE_RENVOYER} dans ${secondesRestantes} s` : LIBELLE_RENVOYER);
