// Interface unique des fournisseurs d'IA de l'aide : { nom, repondre({systeme, messages, maxTokens}) }
// qui renvoie { texte, jetonsEntree, jetonsSortie, jetonsCache, modele }.
//
// Trois modes, choisis par AIDE_FOURNISSEUR : « faux » (défaut partout), « local » (Ollama, développement
// seulement) et « api » (Claude). Changer de fournisseur plus tard = ajouter un fichier ici.
// L'ancien adaptateur Gemini de /api/ai-chat reste inactif et n'est pas branché ici (ses crédits ne servent plus).
import { creerFournisseurFaux } from "./faux.js";
import { creerFournisseurLocal } from "./local.js";
import { creerFournisseurClaude, appelReelAutorise } from "./claude.js";

export const MODES = ["faux", "local", "api"];

/** Mode demandé -> mode réellement utilisé. Toute situation douteuse retombe sur « faux ». */
export function resoudreMode(env = process.env) {
  const demande = String(env?.AIDE_FOURNISSEUR || "faux").toLowerCase();
  if (demande === "local") return env?.NODE_ENV === "development" ? "local" : "faux";
  if (demande === "api") return appelReelAutorise(env) ? "api" : "faux";
  return "faux";
}

export function choisirFournisseur(env = process.env, outils = {}) {
  const mode = resoudreMode(env);
  if (mode === "local") return creerFournisseurLocal({ env, ...outils });
  if (mode === "api") return creerFournisseurClaude({ env, ...outils });
  return creerFournisseurFaux();
}
