import { PHRASE_ALERTE, SUJETS_ALERTE } from "./messages.js";

// Contenu des deux e-mails de « Informations du compte » (pur : utilisé par depsServeur.js et par l'essai d'envoi).

const TITRES_CODE = { preuve: "Votre code de vérification Facilité", nouvelle_valeur: "Confirmez votre nouvelle information Facilité" };
export const SUPPORT_WHATSAPP_URL = "https://wa.me/221771400832";

export function gabaritCode(code, but) {
  return {
    sujet: TITRES_CODE[but] ?? TITRES_CODE.preuve,
    html: `<p>Votre code : <strong style="font-size:24px;letter-spacing:4px">${code}</strong></p><p>Il est valable 10 minutes. Ne le donnez à personne.</p><p>${PHRASE_ALERTE}</p>`,
  };
}

export function gabaritAlerte(action, canal, urlSupport = SUPPORT_WHATSAPP_URL) {
  const sujet = SUJETS_ALERTE[`${action}_${canal}`] ?? "Votre compte Facilité a changé";
  return { sujet, html: `<p>${sujet}.</p><p>${PHRASE_ALERTE}</p><p><a href="${urlSupport}">Contacter le support sur WhatsApp</a></p>` };
}
