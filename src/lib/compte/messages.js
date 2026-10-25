// « Informations du compte » — TOUS les messages montrés à la personne, écrits ici UNE fois et renvoyés par le serveur : le site, Facilité et Locaux affichent
// donc exactement les mêmes phrases. Français simple, phrases courtes, jamais de jargon.

export const MESSAGES = {
  // refus de règle
  derniere_methode_telephone: "Ajoutez d'abord une adresse e-mail pour pouvoir retirer ce numéro.",
  derniere_methode_email: "Ajoutez d'abord un numéro de téléphone pour pouvoir retirer cette adresse e-mail.",
  rien_a_dissocier: "Il n'y a rien à retirer.",
  limite_changements: "Vous avez déjà fait 3 changements aujourd'hui. Réessayez demain.",
  trop_de_demandes: "Trop de demandes. Réessayez dans une heure.",
  telephone_indisponible: "Le changement de téléphone arrive bientôt.",
  // vérification
  code_invalide: "Ce code n'est pas bon. Vérifiez-le et réessayez.",
  code_expire: "Ce code n'est plus valable. Demandez-en un nouveau.",
  trop_d_essais: "Trop d'essais. Demandez un nouveau code.",
  autorisation_invalide: "Votre vérification n'est plus valable. Recommencez.",
  aucune_methode_preuve: "Nous ne pouvons pas vous envoyer de code. Contactez-nous.",
  envoi_impossible: "Le code n'a pas pu être envoyé. Réessayez dans un instant.",
  // nouvelle valeur
  valeur_invalide_email: "Cette adresse e-mail ne semble pas bonne. Vérifiez-la.",
  valeur_invalide_telephone: "Ce numéro ne semble pas bon. Exemple : 77 123 45 67.",
  valeur_prise_email: "Impossible d'utiliser cette adresse. Essayez-en une autre.",
  valeur_prise_telephone: "Impossible d'utiliser ce numéro. Essayez-en un autre.",
  identique_email: "C'est déjà votre adresse e-mail.",
  identique_telephone: "C'est déjà votre numéro.",
  // résultat
  impossible_pour_le_moment: "Impossible pour le moment. Rien n'a été changé. Réessayez plus tard ou contactez-nous.",
  demande_invalide: "Cette demande n'est pas valable.",
};

/** Message pour un code d'erreur, avec la variante propre au moyen (e-mail ou téléphone) quand il y en a une. */
export function messagePour(code, canal) {
  return MESSAGES[`${code}_${canal}`] ?? MESSAGES[code] ?? MESSAGES.impossible_pour_le_moment;
}

/** Texte de confirmation après une réussite (affiché seulement APRÈS avoir relu le compte et constaté le changement). */
const REUSSITE = {
  changer_email: "Votre adresse e-mail a été changée.",
  dissocier_email: "Votre adresse e-mail a été retirée.",
  changer_telephone: "Votre numéro a été changé.",
  dissocier_telephone: "Votre numéro a été retiré.",
};
export const messageReussite = (action, canal) => REUSSITE[`${action}_${canal}`] ?? "C'est fait.";

// Alertes envoyées à l'ancienne adresse e-mail (système d'e-mails existant).
export const SUJETS_ALERTE = {
  changer_email: "Votre adresse e-mail Facilité a été changée",
  dissocier_email: "Votre adresse e-mail Facilité a été retirée",
  changer_telephone: "Votre numéro Facilité a été changé",
  dissocier_telephone: "Votre numéro Facilité a été retiré",
};
export const PHRASE_ALERTE = "Si ce n'est pas vous, contactez-nous tout de suite.";

// Chemin « Je n'ai plus accès » : rien ne change automatiquement, la personne est envoyée vers le support WhatsApp avec les informations à fournir.
export const MESSAGE_SUPPORT_PERDU = {
  titre: "Je n'ai plus accès",
  phrase: "Nous allons vous aider. Rien ne change tant que nous n'avons pas vérifié que c'est bien vous.",
  informations: ["Votre nom", "L'ancien numéro ou l'ancienne adresse e-mail (même si vous ne les avez plus)", "La date approximative de création de votre compte", "Une photo de votre pièce d'identité"],
};
