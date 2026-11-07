// Règles de la dictée (voix -> texte) du panneau Aide. Pure et testable : le navigateur fournit le texte
// compris et, quand il le donne, un indice de confiance entre 0 et 1.
//  - texte vide ou confiance faible : message préparé gratuit (sans IA), 2 essais au maximum ;
//  - après 2 essais ratés : on propose des boutons ou un message vocal à l'équipe ;
//  - texte compris : écran « Confirmer / Corriger » avant tout envoi.
// Le wolof n'est pas promis : la dictée du navigateur le comprend mal.

export const ESSAIS_MAX = 2;
export const SEUIL_CONFIANCE = 0.5;

export const MESSAGE_REPETER = "Je n'ai pas bien compris, pouvez-vous répéter ?";
export const MESSAGE_ALTERNATIVES =
  "Je n'arrive pas à bien comprendre. Choisissez une question ci-dessus, écrivez votre message, ou laissez un message vocal à l'équipe.";

/**
 * @param {{texte?: string, confiance?: number|null, echecsAvant?: number}} p
 * @returns {{action: 'confirmer'|'repeter'|'alternatives', message?: string, texte?: string, echecs: number}}
 */
export function evaluerDictee({ texte, confiance = null, echecsAvant = 0 } = {}) {
  const propre = String(texte || "").replace(/\s+/g, " ").trim();
  const confianceFaible = typeof confiance === "number" && Number.isFinite(confiance) && confiance < SEUIL_CONFIANCE;
  if (propre.length < 2 || confianceFaible) {
    const echecs = echecsAvant + 1;
    if (echecs >= ESSAIS_MAX) return { action: "alternatives", message: MESSAGE_ALTERNATIVES, echecs };
    return { action: "repeter", message: MESSAGE_REPETER, echecs };
  }
  return { action: "confirmer", texte: propre, echecs: 0 };
}
