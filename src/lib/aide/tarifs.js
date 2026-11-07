// Prix du modèle et calcul du coût d'un appel IA, en micro-dollars (1 000 000 = 1 $) pour rester en entiers.
//
// Prix de départ de claude-haiku-5-5 (sources tierces, À VÉRIFIER sur la page de prix d'Anthropic avant
// tout achat de crédits) : 0,10 $ / million de jetons en entrée, 0,50 $ en sortie, 0,01 $ en lecture de
// cache, et un prix multiplié par 5 au-delà de 100 000 jetons par demande. Chaque valeur est réglable par
// variable d'environnement : si Anthropic change ses prix, on corrige sans toucher au code.

export const MODELE_PAR_DEFAUT = "claude-haiku-5-5";

export const TARIFS_PAR_DEFAUT = Object.freeze({
  entreeParMillion: 0.1,
  sortieParMillion: 0.5,
  cacheParMillion: 0.01,
  seuilLongContexte: 100000,
  multiplicateurLong: 5,
});

function nombre(valeur, repli) {
  const n = Number(valeur);
  return Number.isFinite(n) && n >= 0 ? n : repli;
}

export function lireTarifs(env = process.env) {
  return {
    entreeParMillion: nombre(env.AIDE_PRIX_ENTREE_USD_M, TARIFS_PAR_DEFAUT.entreeParMillion),
    sortieParMillion: nombre(env.AIDE_PRIX_SORTIE_USD_M, TARIFS_PAR_DEFAUT.sortieParMillion),
    cacheParMillion: nombre(env.AIDE_PRIX_CACHE_USD_M, TARIFS_PAR_DEFAUT.cacheParMillion),
    seuilLongContexte: nombre(env.AIDE_SEUIL_LONG_CONTEXTE, TARIFS_PAR_DEFAUT.seuilLongContexte),
    multiplicateurLong: nombre(env.AIDE_MULTIPLICATEUR_LONG, TARIFS_PAR_DEFAUT.multiplicateurLong),
  };
}

/**
 * Coût en micro-dollars d'un appel. 1 $ par million de jetons = 1 micro-dollar par jeton, donc le prix
 * par million EST le coût en micro-dollars d'un jeton. Arrondi au supérieur : on ne sous-estime jamais.
 * @param {{entree?: number, sortie?: number, cache?: number}} jetons
 */
export function coutMicroUsd(jetons, tarifs = TARIFS_PAR_DEFAUT) {
  const entree = Math.max(0, Number(jetons?.entree) || 0);
  const sortie = Math.max(0, Number(jetons?.sortie) || 0);
  const cache = Math.max(0, Number(jetons?.cache) || 0);
  const long = entree + cache > tarifs.seuilLongContexte;
  const facteur = long ? tarifs.multiplicateurLong : 1;
  return Math.ceil((entree * tarifs.entreeParMillion + sortie * tarifs.sortieParMillion + cache * tarifs.cacheParMillion) * facteur);
}

/** Estimation avant l'appel (pire cas côté sortie : max_tokens), pour savoir s'il reste de la marge. */
export function estimationAvantAppel({ jetonsEntreeEstimes, maxTokens }, tarifs = TARIFS_PAR_DEFAUT) {
  return coutMicroUsd({ entree: jetonsEntreeEstimes, sortie: maxTokens }, tarifs);
}

/** Estimation grossière du nombre de jetons d'un texte français (~3,5 caractères par jeton, arrondi au supérieur). */
export function estimerJetons(texte) {
  return Math.ceil(String(texte || "").length / 3.5);
}
