// Règle pure de l'interrupteur « connexion et inscription par téléphone » (sans accès à la base : testée seule). Voir connexionTelephoneInterrupteur.js pour la lecture.

export const ID_INTERRUPTEUR_TELEPHONE = "feat_connexion_telephone";

/** `ligne` = { enabled, roles } lue dans feature_flags, ou null. Ouvert seulement si enabled === true et si les visiteurs (non connectés) sont autorisés. */
export function telephoneOuvert(ligne) {
  return Boolean(ligne) && ligne.enabled === true && ligne.roles?.visitor !== false;
}
