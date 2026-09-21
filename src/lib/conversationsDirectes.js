/**
 * Classement d'un fil "direct" de la messagerie (acheteur <-> vendeur,
 * candidat <-> recruteur).
 *
 * Pourquoi cette fonction existe : la table `conversations` a UNE ligne par
 * paire d'utilisateurs. Le même couple peut donc partager une candidature
 * (messages OFFRE) et un échange Marketplace (messages MARKETPLACE). Classé
 * seulement d'après "contient une candidature", le fil d'un acheteur ayant déjà
 * postulé chez le propriétaire de la boutique devenait "Offre d'emploi" :
 * lecture seule, absent de la liste Marketplace, et "Discuter sur la
 * plateforme" ouvrait ce dossier de candidature au lieu d'un fil vendeur.
 *
 * Règle : en contexte Marketplace, la paire est présentée comme un fil
 * Marketplace dès qu'elle a des messages MARKETPLACE, ou quand l'utilisateur
 * vient de l'ouvrir explicitement ("Discuter sur la plateforme"). Le contenu de
 * la candidature n'y est jamais affiché (elle reste intacte côté Facilité).
 * Hors contexte Marketplace, la règle historique s'applique.
 *
 * @param {object} p
 * @param {Array<{typeDiscussion?: string}>} p.messages messages formatés de la paire
 * @param {boolean} p.aBoutique l'autre partie possède une boutique
 * @param {boolean} p.contexteMarketplace la page est ouverte avec ?contexte=marketplace
 * @param {boolean} p.ouvertePourMarketplace l'utilisateur a demandé CE fil ("Discuter sur la plateforme")
 * @returns {{estMarketplace: boolean, contientOffre: boolean, typeDiscussion: string, messages: Array}}
 */
export function classerConversationDirecte({
  messages = [],
  aBoutique = false,
  contexteMarketplace = false,
  ouvertePourMarketplace = false,
}) {
  const contientOffre = messages.some((m) => m.typeDiscussion === "OFFRE");
  const aMessageMarketplace = messages.some((m) => m.typeDiscussion === "MARKETPLACE");

  // Règle historique : une candidature (OFFRE) exclut le fil du Marketplace ;
  // sans message, le statut de propriétaire de boutique sert de repère ; sinon
  // l'étiquette réelle des messages fait foi.
  let estMarketplace = !contientOffre && (messages.length === 0 ? aBoutique : aMessageMarketplace);

  if (contexteMarketplace && (aMessageMarketplace || ouvertePourMarketplace)) {
    estMarketplace = true;
  }

  return {
    estMarketplace,
    contientOffre,
    typeDiscussion: estMarketplace ? "MARKETPLACE" : contientOffre ? "OFFRE" : "ECHANGE",
    messages: estMarketplace ? messages.filter((m) => m.typeDiscussion !== "OFFRE") : messages,
  };
}
