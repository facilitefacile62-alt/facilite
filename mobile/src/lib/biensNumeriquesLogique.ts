// Biens numériques payés dans l'application (jetons et Premium de Locaux, formation, modèles de CV) — logique PURE, sans import : testable seule.
//
// Règle Apple 3.1.1 : un bien numérique acheté et consommé dans une application iOS doit passer par l'achat intégré d'Apple, et l'application ne
// doit ni afficher un prix, ni proposer un bouton d'achat, ni renvoyer vers un paiement externe. Sur iOS, ces achats sont donc masqués ou remplacés
// par un message NEUTRE (aucun prix, aucun bouton d'achat, aucun lien, aucune allusion à un autre moyen de payer). Android (APK direct) et le site
// gardent l'achat.

export const MESSAGE_ACHAT_INDISPONIBLE = "Cette fonction n'est pas disponible sur cet appareil.";

/** L'achat de biens numériques n'est autorisé dans l'application que hors iOS. */
export const achatNumeriqueAutorise = (os: string): boolean => os !== 'ios';

/** Marqueur ajouté à l'identité (user-agent) des pages du site ouvertes dans l'application iOS : le site y masque ses paiements. */
export const MARQUEUR_APP_IOS = 'FaciliteApp/ios';
export const marqueurAgentUtilisateur = (os: string): string | undefined => (os === 'ios' ? MARQUEUR_APP_IOS : undefined);

/** Pages du site dont le seul but est un paiement de bien numérique : jamais ouvertes dans l'application iOS. */
export const CLES_WEB_PAIEMENT = ['premium', 'formations'] as const;
export const cleWebBloquee = (cle: string | undefined, os: string): boolean =>
  os === 'ios' && (CLES_WEB_PAIEMENT as readonly string[]).includes(String(cle));
