// Prix de TEST de l'achat de jetons, réservé à des comptes précis : 1 FCFA par jeton au lieu du tarif configuré, pour pouvoir tester un
// paiement Orange Money de bout en bout avec un très petit montant.
//
// Sécurité : la liste des comptes vient UNIQUEMENT de la variable d'environnement serveur ORANGE_TEST_PRIX_USER_IDS (identifiants
// d'utilisateurs séparés par des virgules, espaces ou points-virgules) et on la compare à l'identifiant de l'utilisateur authentifié côté
// serveur. Rien ne vient du navigateur : ni prix, ni identifiant, ni drapeau. Variable absente, vide ou sans identifiant valide : personne
// n'a le prix de test (tarif configuré pour tout le monde). Le montant calculé ici est celui enregistré dans la commande : le webhook, le
// rattrapage et la confirmation auprès d'Orange vérifient donc toujours le montant réellement demandé.
export const PRIX_TEST_JETON_FCFA = 1;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Identifiants valides (UUID, en minuscules) de la variable ; les valeurs invalides sont ignorées. */
export function idsPrixTest(env = process.env) {
  return String(env.ORANGE_TEST_PRIX_USER_IDS ?? "")
    .split(/[\s,;]+/)
    .map((v) => v.trim().toLowerCase())
    .filter((v) => UUID.test(v));
}

/** Vrai seulement si l'utilisateur authentifié figure dans la liste du serveur. */
export function aLePrixTest(userId, env = process.env) {
  if (typeof userId !== "string" || !UUID.test(userId)) return false;
  return idsPrixTest(env).includes(userId.toLowerCase());
}

/** Prix d'un jeton en FCFA : 1 pour un compte de test, sinon le tarif configuré (jetons_config). */
export function prixJetonFcfa({ userId, tarifConfigureFcfa, env = process.env }) {
  return aLePrixTest(userId, env) ? PRIX_TEST_JETON_FCFA : tarifConfigureFcfa;
}
