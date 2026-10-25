import { Redis } from "@upstash/redis";

// Limiteur de fréquence à fenêtre FIXE et paramétrable (par heure, par jour…), même fournisseur que checkRateLimit() de apiAuth.js (Upstash Redis) avec le
// même repli en mémoire. checkRateLimit() est figé à 20 requêtes par minute : il ne convient pas à « 3 envois de code par heure ».
//
// Comme pour apiAuth.js : l'appel Redis est BORNÉ dans le temps (un Upstash lent ne doit jamais retenir la requête), et en cas d'erreur ou de dépassement
// on retombe sur le compteur mémoire local à l'instance.

const DELAI_REDIS_MS = 1000;

let redis;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN, retry: { retries: 1, backoff: () => 200 } });
  } catch {
    redis = undefined;
  }
}

const compteursMemoire = new Map(); // cle -> { debut, n }

/** Compteur mémoire (repli, tests) : retourne le nombre d'appels dans la fenêtre en cours, celui-ci compris. */
export function compterEnMemoire(cle, fenetreSecondes, maintenantMs = Date.now(), magasin = compteursMemoire) {
  if (magasin.size > 5000) {
    for (const [k, v] of magasin) if (maintenantMs - v.debut >= v.fenetre * 1000) magasin.delete(k);
  }
  const existant = magasin.get(cle);
  if (!existant || maintenantMs - existant.debut >= fenetreSecondes * 1000) {
    magasin.set(cle, { debut: maintenantMs, n: 1, fenetre: fenetreSecondes });
    return 1;
  }
  existant.n += 1;
  return existant.n;
}

/**
 * Autorise-t-on cet appel ? `cle` identifie le compteur (ex. « compte:envoi:u:<id> »), `max` le nombre d'appels permis dans `fenetreSecondes`.
 * Retourne true si l'appel est permis, false s'il dépasse la limite. `delaiMs` borne l'attente de Redis (le hook SMS n'a que 5 s au total).
 */
export async function limiter(cle, max, fenetreSecondes, delaiMs = DELAI_REDIS_MS) {
  if (redis) {
    try {
      const resultat = await Promise.race([
        redis.pipeline().incr(`limite:${cle}`).expire(`limite:${cle}`, fenetreSecondes, "NX").exec(),
        new Promise((resolve) => setTimeout(() => resolve(null), delaiMs)),
      ]);
      if (resultat !== null) return Number(resultat[0]) <= max;
    } catch (erreur) {
      console.error("[Limiteur] Redis :", erreur?.message);
    }
  }
  return compterEnMemoire(cle, fenetreSecondes) <= max;
}
