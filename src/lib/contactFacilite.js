// Coordonnées de contact de Facilité déjà publiées sur le site : source unique pour la page /contact et le WhatsApp d'assistance.
// Aucune autre adresse, aucun autre numéro n'est déclaré ici : une information qui manque (raison sociale, numéro d'enregistrement, adresse postale) reste
// VIDE (voir FACILITE_EDITEUR plus bas) et son bloc n'est alors pas affiché sur la page /contact, jamais inventé.

/** WhatsApp d'assistance (chiffres seuls, pour wa.me) et son affichage. Même numéro que celui de la FAQ. */
export const FACILITE_WHATSAPP_NUMBER = "221771400832";
export const FACILITE_WHATSAPP_DISPLAY = "+221 77 140 08 32";

/** Adresse e-mail déjà indiquée comme contact dans les conditions d'utilisation, la politique de confidentialité et la boîte à idées. */
export const FACILITE_EMAIL_CONTACT = "facilitefacile@gmail.com";

// Informations de l'éditeur du site, affichées sur /contact SEULEMENT quand les trois valeurs ci-dessous sont renseignées. Tant qu'une valeur est vide, le bloc
// « Éditeur du site » est absent de la page publique : rien n'est affiché, rien n'est inventé. À compléter par l'éditeur avec ses vraies informations.
export const FACILITE_EDITEUR = Object.freeze({
  raisonSociale: "",
  numeroEnregistrement: "",
  adresse: "",
});

/** Les trois informations de l'éditeur (raison sociale, numéro d'enregistrement, adresse) sont-elles toutes renseignées ? */
export function editeurRenseigne(editeur = FACILITE_EDITEUR) {
  return ["raisonSociale", "numeroEnregistrement", "adresse"].every((cle) => typeof editeur?.[cle] === "string" && editeur[cle].trim() !== "");
}
