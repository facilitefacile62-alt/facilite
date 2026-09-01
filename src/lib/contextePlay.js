"use client";

// Sommes-nous dans l'application Android publiée sur Google Play ?
//
// POURQUOI CETTE QUESTION SE POSE
//
// Google impose Play Billing pour tout contenu numérique acheté et consommé
// dans une application distribuée sur son store, et interdit en plus de
// renvoyer la personne payer ailleurs (règle dite « anti-steering »). La
// confection de CV à 1500 FCFA est exactement cela : un produit numérique
// fabriqué et livré dans l'application. Proposée depuis l'app Android avec
// KPay ou PayDunya, elle vaut un rejet, puis un retrait.
//
// L'achat reste donc disponible sur le site web, et disparaît dans l'app.
// Aucune mention d'un autre moyen de payer n'est affichée à la place : la
// règle anti-steering interdit aussi l'allusion.
//
// COMMENT LA DÉTECTION FONCTIONNE
//
// Une TWA (Trusted Web Activity) affiche le site dans Chrome, sans barre
// d'adresse. Rien ne distingue le rendu — mais Chrome renseigne alors
// `document.referrer` avec `android-app://<nom.du.paquet>`. C'est la méthode
// documentée par Google, et elle ne demande aucune modification du projet
// Android existant.
//
// Deux limites, traitées ici :
//
//  1. Ce referrer n'est posé qu'à la PREMIÈRE navigation. Dès la deuxième
//     page, il est vide et la détection retomberait à faux : l'achat
//     réapparaîtrait au bout d'un clic. On mémorise donc le résultat.
//
//  2. On mémorise dans `sessionStorage`, jamais dans `localStorage`. Une TWA
//     partage le stockage de Chrome pour la même origine : un drapeau écrit
//     dans localStorage suivrait la personne jusque dans son navigateur
//     ordinaire et y masquerait l'achat — donc ferait perdre des ventes sur
//     le canal principal. `sessionStorage` est propre à chaque contexte de
//     navigation, l'app et le navigateur ne se contaminent pas.
//
// Un second signal est accepté : le paramètre `?source=play` dans l'URL de
// départ. Il n'est pas nécessaire aujourd'hui ; l'ajouter au `start_url` du
// manifeste TWA rendrait la détection insensible au comportement du referrer
// si Chrome venait à le changer.

const CLE = "facilite:contexte-play";

/**
 * @returns {boolean} vrai uniquement si l'on tourne dans l'app Android.
 *
 * En cas de doute, renvoie faux — c'est-à-dire « on est sur le web, montre
 * l'achat ». Le choix est délibéré : cette fonction est appelée depuis le
 * navigateur de tout le monde, et un faux positif masquerait la vente à des
 * gens qui n'ont jamais installé l'application.
 */
export function estDansAppPlay() {
  if (typeof window === "undefined") return false;

  // Mémorisé lors d'une navigation précédente de la même session.
  try {
    if (window.sessionStorage.getItem(CLE) === "1") return true;
  } catch {
    // Stockage refusé (navigation privée, réglage strict) : on continue avec
    // les signaux directs ci-dessous plutôt que d'échouer.
  }

  let detecte = false;

  // Signal 1 — le referrer posé par Chrome au lancement de la TWA.
  try {
    if (typeof document !== "undefined" && String(document.referrer || "").startsWith("android-app://")) {
      detecte = true;
    }
  } catch {
    // Ignoré : un referrer illisible n'est pas une preuve.
  }

  // Signal 2 — marqueur explicite dans l'URL de départ, si le manifeste TWA
  // en pose un.
  try {
    if (new URL(window.location.href).searchParams.get("source") === "play") {
      detecte = true;
    }
  } catch {
    // URL illisible : on s'en tient au signal 1.
  }

  if (detecte) {
    try {
      window.sessionStorage.setItem(CLE, "1");
    } catch {
      // Sans mémorisation, la détection retombera peut-être à faux sur la
      // page suivante. On préfère ça à une exception qui casserait le rendu.
    }
  }

  return detecte;
}
