// Mémoire des réponses déjà données pour les questions GÉNÉRIQUES identiques.
// Règle absolue : jamais de donnée personnelle dans la mémoire (ni dans la question, ni dans la réponse).
import { createHash } from "node:crypto";
import { normaliserQuestion } from "./texte.js";

export { normaliserQuestion };

const MOTIFS_PERSONNELS = [
  /@/, // adresse e-mail
  /https?:|www\./i, // lien
  /\d{4,}/, // numéro de téléphone, de commande, de compte…
  /(\+|00)\s*\d{2,3}[\s.-]?\d/, // indicatif
  /je\s+m['’ ]?appelle|mon\s+nom\s+(est|c['’]est)|my\s+name/i,
  /mon\s+(num[ée]ro|t[ée]l[ée]phone|e-?mail|adresse|mot de passe|code|identifiant|compte|pin)/i,
  /ma\s+commande|mon\s+paiement|ma\s+facture/i,
  /\b(je\s+suis|moi\s+c['’]est)\s+[A-ZÉÈÀ][a-zéèêàç]+/, // « je suis Awa… »
];

export function contientDonneePersonnelle(texte) {
  const t = String(texte || "");
  return MOTIFS_PERSONNELS.some((m) => m.test(t));
}

/** Empreinte stable de la question normalisée (jamais le texte brut en base). */
export function cleMemoire(texte) {
  return createHash("sha256").update(normaliserQuestion(texte)).digest("hex");
}

/** Une question/réponse n'entre en mémoire que si elle est générique, assez courte et sans donnée personnelle. */
export function peutMemoriser(question, reponse) {
  const q = String(question || "");
  const r = String(reponse || "");
  if (q.trim().length < 8 || q.length > 200 || r.trim().length < 10 || r.length > 1500) return false;
  if (contientDonneePersonnelle(q) || contientDonneePersonnelle(r)) return false;
  return true;
}
