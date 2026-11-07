// Disposition du panneau « Aide » : décisions d'APPARENCE uniquement, pures et testables. Aucune logique de
// réponse, de limite, de coût ou d'accès n'est ici.
import { QUESTIONS_FREQUENTES, IDS_PRINCIPAUX } from "./preparees.js";

/** Tailles de l'orbe du panneau, en pixels : grand tant qu'il n'y a que l'accueil, petit ensuite. */
export const TAILLE_ORBE = Object.freeze({ grand: 104, petit: 48 });

export const MENTION_ASSISTANT = "L'assistant peut faire des erreurs. Vérifiez les informations importantes.";

/**
 * L'orbe est GRAND uniquement s'il n'y a que le message d'accueil, que la personne n'a pas fait défiler, que l'écran
 * n'est pas petit et que le clavier n'est pas ouvert. Dans tous les autres cas, il passe directement à la petite taille.
 * @returns {"grand"|"petit"}
 */
export function tailleOrbe({ conversationCommencee = false, aDefile = false, petitEcran = false, clavierOuvert = false } = {}) {
  return conversationCommencee || aDefile || petitEcran || clavierOuvert ? "petit" : "grand";
}

/** Ligne d'état sous le titre de l'en-tête. */
export function libelleEtat(mode) {
  if (mode === "attente_humain") return "En attente d'un conseiller";
  if (mode === "humain") return "Un conseiller vous répond";
  return "Assistant en ligne";
}

/** 3 questions en pilules (les plus utiles), puis les autres derrière « Plus de questions ». */
export function separerQuestions(questions = QUESTIONS_FREQUENTES) {
  const principales = IDS_PRINCIPAUX.map((id) => questions.find((q) => q.id === id)).filter(Boolean);
  const autres = questions.filter((q) => !IDS_PRINCIPAUX.includes(q.id));
  return { principales, autres };
}
