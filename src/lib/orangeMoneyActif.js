// Interrupteur du paiement Orange Money : DÉSACTIVÉ par défaut. Le paiement n'est proposé (page Premium, formation CV) et ne peut être
// créé (routes de paiement) que si ORANGE_MONEY_ENABLED vaut exactement « true » ET que les trois identifiants Orange sont renseignés.
// Aucune clé de production configurée, ou variable d'activation absente : l'option reste invisible pour les utilisateurs.
// Ne touche ni aux notifications (webhooks) ni au rattrapage : une commande déjà payée doit toujours pouvoir être finalisée.
export function orangeMoneyActif(env = process.env) {
  return (
    env.ORANGE_MONEY_ENABLED === "true" &&
    Boolean(env.ORANGE_MONEY_CLIENT_ID) &&
    Boolean(env.ORANGE_MONEY_CLIENT_SECRET) &&
    Boolean(env.ORANGE_MONEY_MERCHANT_CODE)
  );
}
