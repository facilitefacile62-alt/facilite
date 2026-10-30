// Planificateur de rechargement d'une liste d'offres : économe en requêtes, sans changer ce que la personne voit.
//
// Avant : la liste se rechargeait à l'ouverture, à CHAQUE événement temps réel (immédiatement), à chaque retour d'onglet, et toutes les 60 secondes sans
// jamais s'arrêter, même onglet caché. Un onglet oublié ouvert faisait donc 60 requêtes par heure toute la nuit.
//
// Maintenant :
//   - onglet CACHÉ : aucune requête (ni sondage, ni rechargement sur événement). Si une modification arrive pendant ce temps, la liste est marquée « à jour
//     plus tard » et se recharge UNE fois au retour de l'onglet ;
//   - onglet VISIBLE : un sondage lent (5 minutes par défaut, le temps réel couvrant l'essentiel) ;
//   - événements temps réel : regroupés, la liste se recharge une seule fois, 5 secondes après le DERNIER événement d'une rafale ;
//   - retour d'onglet : rechargement seulement si la liste est plus ancienne que 60 secondes ou marquée « à jour plus tard » (avant : toujours).
//
// Options :
//   charger(), estVisible() : fonctions de l'appelant ;
//   delaiAttenteMs (5000), intervalleVisibleMs (300000 ; 0 ou null = pas de sondage), ecartMinimalMs (60000 ; null = ne recharge au retour que si marquée) ;
//   maintenant, minuteur : remplaçables (tests).
export function creerRafraichissement({
  charger,
  estVisible,
  delaiAttenteMs = 5000,
  intervalleVisibleMs = 300000,
  ecartMinimalMs = 60000,
  maintenant = () => Date.now(),
  minuteur = { setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (id) => clearTimeout(id) },
} = {}) {
  let derniereCharge = null;
  let aMettreAJour = false;
  let attente = null;
  let sondage = null;
  let arrete = false;

  const lancer = () => {
    derniereCharge = maintenant();
    aMettreAJour = false;
    return charger();
  };
  const armerSondage = () => {
    if (sondage !== null || !intervalleVisibleMs || arrete) return;
    sondage = minuteur.setTimeout(tic, intervalleVisibleMs);
  };
  const stopperSondage = () => {
    if (sondage !== null) {
      minuteur.clearTimeout(sondage);
      sondage = null;
    }
  };
  function tic() {
    sondage = null;
    if (arrete || !estVisible()) return; // onglet caché : le sondage s'arrête, il repartira au retour de l'onglet
    lancer();
    armerSondage();
  }

  return {
    /** Premier chargement (comme avant), puis sondage lent si l'onglet est visible. */
    demarrer() {
      lancer();
      if (estVisible()) armerSondage();
    },
    /** Un événement temps réel est arrivé. */
    surChangement() {
      if (arrete) return;
      if (!estVisible()) {
        aMettreAJour = true;
        return;
      }
      if (attente !== null) minuteur.clearTimeout(attente);
      attente = minuteur.setTimeout(() => {
        attente = null;
        if (arrete) return;
        if (estVisible()) lancer();
        else aMettreAJour = true;
      }, delaiAttenteMs);
    },
    /** L'onglet vient d'être caché ou affiché. */
    surVisibilite() {
      if (arrete) return;
      if (!estVisible()) {
        stopperSondage();
        return;
      }
      const ancien = ecartMinimalMs !== null && derniereCharge !== null && maintenant() - derniereCharge >= ecartMinimalMs;
      if (aMettreAJour || ancien) lancer();
      armerSondage();
    },
    arreter() {
      arrete = true;
      stopperSondage();
      if (attente !== null) {
        minuteur.clearTimeout(attente);
        attente = null;
      }
    },
  };
}
