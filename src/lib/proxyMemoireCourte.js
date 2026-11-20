/**
 * Mémoire courte du proxy (src/proxy.js).
 *
 * Pourquoi : le proxy s'exécute sur CHAQUE page non statique, y compris les préchargements de liens et les
 * requêtes de navigation de l'application. Avant ce module il lisait la base à chaque passage (rôle du
 * compte, liste complète des interrupteurs), et il comptait pour l'essentiel du temps de calcul facturé
 * par Vercel (dépassement du 18/11/2026).
 *
 * Ce que fait la mémoire : elle garde un résultat quelques secondes DANS l'instance serveur (Vercel réutilise
 * une instance pour de nombreuses requêtes). Rien n'est partagé entre instances et rien n'est écrit en base.
 *  - un chargement en cours est partagé : dix requêtes simultanées pour la même clé ne font qu'UNE lecture ;
 *  - un chargement qui échoue (délai dépassé, erreur) n'est JAMAIS gardé : l'appelant reçoit l'erreur, comme
 *    avant (le proxy laisse alors passer, voir « fail-open » dans proxy.js) ;
 *  - un résultat jugé non mémorisable (ex. compte sans ligne de rôle) n'est pas gardé non plus.
 *
 * Le délai d'effet d'une modification (interrupteur changé par l'admin, compte suspendu) est donc au plus la
 * durée choisie dans proxy.js. Le verrou réel d'un compte suspendu reste dans PostgreSQL
 * (current_user_role() renvoie NULL) : le proxy n'est que la couche d'affichage.
 */

export function creerMemoireCourte({ dureeMs, max = 500, maintenant = () => Date.now() }) {
  const entrees = new Map();

  function valide(cle) {
    const e = entrees.get(cle);
    if (!e) return null;
    if (maintenant() >= e.expire) {
      entrees.delete(cle);
      return null;
    }
    return e;
  }

  return {
    /**
     * Renvoie la valeur gardée pour `cle`, sinon appelle `charger()` (promesse) et la garde `dureeMs`.
     * `memoriserSi(valeur)` : si elle renvoie faux, la valeur est rendue mais pas gardée.
     */
    async lireOuCharger(cle, charger, memoriserSi = () => true) {
      if (!(dureeMs > 0)) return charger();
      const existante = valide(cle);
      if (existante) return existante.promesse;

      if (entrees.size >= max) entrees.delete(entrees.keys().next().value);
      const entree = { expire: maintenant() + dureeMs, promesse: null };
      entree.promesse = Promise.resolve()
        .then(charger)
        .then(
          (valeur) => {
            if (!memoriserSi(valeur) && entrees.get(cle) === entree) entrees.delete(cle);
            return valeur;
          },
          (erreur) => {
            if (entrees.get(cle) === entree) entrees.delete(cle);
            throw erreur;
          }
        );
      entrees.set(cle, entree);
      return entree.promesse;
    },
    /** Oublie une clé (ex. après une réactivation de compte, pour relire l'état réel). */
    oublier(cle) {
      entrees.delete(cle);
    },
    vider() {
      entrees.clear();
    },
    taille() {
      return entrees.size;
    },
  };
}
