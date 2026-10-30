// Biens numériques payés dans l'application (jetons et Premium de Locaux, formation, modèles de CV) — logique PURE, sans import : testable seule.
//
// Règle Apple 3.1.1 (iPhone) et règle de Google Play sur les paiements (Android) : un bien numérique acheté et consommé dans une application distribuée par
// leur boutique doit passer par leur facturation, et l'application ne doit ni afficher un prix, ni proposer un bouton d'achat, ni renvoyer vers un paiement
// externe. Ces achats sont donc masqués ou remplacés par un message NEUTRE (aucun prix, aucun bouton d'achat, aucun lien, aucune allusion à un autre moyen de
// payer). Le site garde ses paiements.
//
// iPhone : toujours masqués. Android : masqués TANT QUE l'interrupteur serveur feat_paiements_application est fermé (fermé par défaut, et en cas de doute :
// interrupteur illisible = fermé). Aucune nouvelle version n'est nécessaire pour les rouvrir.

export const MESSAGE_ACHAT_INDISPONIBLE = "Cette fonction n'est pas disponible sur cet appareil.";

export const ID_INTERRUPTEUR_PAIEMENTS = 'feat_paiements_application';

/** L'achat de biens numériques n'est autorisé dans l'application que hors iOS ET si l'interrupteur serveur est ouvert (jamais par défaut). */
export const achatNumeriqueAutorise = (os: string, interrupteurOuvert: boolean): boolean => os !== 'ios' && interrupteurOuvert === true;

/** Marqueur ajouté à l'identité (user-agent) des pages du site ouvertes dans l'application iOS. */
export const MARQUEUR_APP_IOS = 'FaciliteApp/ios';
export const marqueurAgentUtilisateur = (os: string): string | undefined => (os === 'ios' ? MARQUEUR_APP_IOS : undefined);

/** Pages du site dont le seul but est un paiement de bien numérique (Premium, formation, facturation : jetons et mise en avant) : jamais ouvertes quand l'achat n'est pas autorisé. */
export const CLES_WEB_PAIEMENT = ['premium', 'formations', 'facturation'] as const;
export const cleWebBloquee = (cle: string | undefined, os: string, interrupteurOuvert: boolean): boolean =>
  !achatNumeriqueAutorise(os, interrupteurOuvert) && (CLES_WEB_PAIEMENT as readonly string[]).includes(String(cle));

/** Chemins du site qui sont des pages de paiement : une page déjà ouverte dans l'application ne peut pas y mener par un lien quand l'achat n'est pas autorisé. */
export const CHEMINS_WEB_PAIEMENT = ['/premium', '/formations', '/formation-redaction-cv', '/candidat/facturation', '/achat-cv'] as const;
export function estCheminPaiement(url: string): boolean {
  const chemin = url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '').split(/[?#]/)[0] || '/';
  return (CHEMINS_WEB_PAIEMENT as readonly string[]).some((c) => chemin === c || chemin.startsWith(`${c}/`));
}
/** Navigation à refuser dans une page du site ouverte dans l'application : lien vers une page de paiement alors que l'achat n'est pas autorisé. */
export const navigationWebBloquee = (url: string, os: string, interrupteurOuvert: boolean): boolean =>
  !achatNumeriqueAutorise(os, interrupteurOuvert) && estCheminPaiement(url);
