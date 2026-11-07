// Plafond de dépense de l'IA d'aide — FAIL-CLOSED : au moindre doute (valeur illisible, erreur
// d'infrastructure), l'IA n'est PAS appelée et la conversation retombe sur les réponses préparées et
// le support humain. Jamais l'inverse.

export const PLAFOND_JOUR_PAR_DEFAUT_USD = 1;
export const PLAFOND_MOIS_PAR_DEFAUT_USD = 5;

function positif(valeur) {
  // null, vide, booléen : illisibles (Number(null) vaudrait 0 et serait pris pour une vraie valeur).
  if (typeof valeur !== "number" && !(typeof valeur === "string" && valeur.trim() !== "")) return null;
  const n = Number(valeur);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Plafonds effectifs en micro-dollars : le plus bas entre la variable d'environnement (ou la valeur par
 * défaut) et le réglage modifiable par l'administrateur. Un réglage illisible est ignoré (on garde le plus prudent).
 */
export function plafondsEffectifs({ reglages, env = process.env } = {}) {
  const jourEnv = positif(env?.AIDE_PLAFOND_JOUR_USD) ?? PLAFOND_JOUR_PAR_DEFAUT_USD;
  const moisEnv = positif(env?.AIDE_PLAFOND_MOIS_USD) ?? PLAFOND_MOIS_PAR_DEFAUT_USD;
  const jourBase = positif(reglages?.plafond_jour_usd);
  const moisBase = positif(reglages?.plafond_mois_usd);
  const jour = jourBase === null ? jourEnv : Math.min(jourEnv, jourBase);
  const mois = moisBase === null ? moisEnv : Math.min(moisEnv, moisBase);
  return { jourMicro: Math.round(jour * 1e6), moisMicro: Math.round(mois * 1e6) };
}

/**
 * @param {{coutJourMicro: unknown, coutMoisMicro: unknown, estimationAppelMicro: number, plafonds: {jourMicro: number, moisMicro: number}}} p
 * @returns {{autorise: boolean, raison: 'ok'|'jour'|'mois'|'inconnu'}}
 */
export function verifierPlafond({ coutJourMicro, coutMoisMicro, estimationAppelMicro, plafonds }) {
  const jour = positif(coutJourMicro);
  const mois = positif(coutMoisMicro);
  const estimation = positif(estimationAppelMicro);
  if (jour === null || mois === null || estimation === null || !plafonds) return { autorise: false, raison: "inconnu" };
  if (jour + estimation > plafonds.jourMicro) return { autorise: false, raison: "jour" };
  if (mois + estimation > plafonds.moisMicro) return { autorise: false, raison: "mois" };
  return { autorise: true, raison: "ok" };
}
