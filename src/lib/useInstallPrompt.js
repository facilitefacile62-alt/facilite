"use client";

// Capture l'événement d'installation PWA du navigateur.
//
// POURQUOI UN ÉTAT MODULE, PAS UN useState DANS UN EFFET
//
// `beforeinstallprompt` ne se déclenche qu'UNE fois par visite, tôt, et le
// navigateur ne le renvoie pas sur demande — s'il n'est pas capturé au bon
// endroit, le bouton n'a plus rien à proposer quand la personne clique. Le
// stocker au niveau du module (pas dans un composant) garantit qu'il est
// capturé une seule fois dès le premier chargement de la page, quel que
// soit le nombre de composants qui utilisent ce hook ensuite — le bouton du
// header et la tuile du menu mobile partagent la même capture.
//
// useSyncExternalStore plutôt que useState+useEffect : ces valeurs
// (installation déjà faite, plateforme) dépendent de l'objet `window`, donc
// diffèrent entre le rendu serveur et le navigateur. Un useEffect qui les
// corrige après coup ferait clignoter le bouton à l'affichage ; ici, React
// sait directement qu'il doit rendre la valeur serveur (false / "inconnu")
// puis se resynchroniser sans repasser par un rendu intermédiaire visible.
//
// CE QUE LE NAVIGATEUR NE PERMET PAS
//
// - Safari (iOS et macOS) n'émet jamais `beforeinstallprompt` : Apple exige
//   le geste manuel Partager → Sur l'écran d'accueil. Aucun code ne peut
//   déclencher ça à la place de la personne — au mieux, on peut lui montrer
//   comment faire (voir BoutonInstallerApp).
// - Une fois l'app installée, le navigateur ne redéclenche plus l'événement
//   pour cette origine tant qu'elle reste installée.
import { useSyncExternalStore } from "react";

let evenementCapture = null;
let dejaInstallee = false;
const abonnes = new Set();

const notifier = () => {
  for (const cb of abonnes) cb();
};

/** @returns {"android" | "ios" | "desktop" | "inconnu"} */
function detecterPlateforme() {
  if (typeof navigator === "undefined") return "inconnu";
  const ua = navigator.userAgent || "";
  // iPadOS se présente en Mac par défaut depuis iPadOS 13 : le test tactile
  // distingue un vrai Mac d'un iPad qui ment sur son user-agent.
  const estIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (estIOS) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

function estDejaInstallee() {
  if (typeof window === "undefined") return false;
  // display-mode: standalone couvre Chrome/Edge/Android ; navigator.standalone
  // est la seule façon de le savoir sous Safari iOS.
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator?.standalone === true;
}

// Écouteurs posés une seule fois, à l'évaluation du module — pas dans un
// composant, précisément pour ne rien manquer si le composant qui affiche
// le bouton n'est pas encore monté au moment où l'événement arrive.
if (typeof window !== "undefined") {
  dejaInstallee = estDejaInstallee();

  window.addEventListener("beforeinstallprompt", (e) => {
    // Empêche la mini-infobar automatique de Chrome : le bouton du site
    // est l'unique invite, pour un rendu cohérent avec le reste de la page
    // plutôt qu'un bandeau système qui apparaît et disparaît seul.
    e.preventDefault();
    evenementCapture = e;
    notifier();
  });

  window.addEventListener("appinstalled", () => {
    dejaInstallee = true;
    evenementCapture = null;
    notifier();
  });
}

const sAbonner = (cb) => {
  abonnes.add(cb);
  return () => abonnes.delete(cb);
};

export function useInstallPrompt() {
  const evenementDiffere = useSyncExternalStore(sAbonner, () => evenementCapture, () => null);
  const installee = useSyncExternalStore(sAbonner, () => dejaInstallee, () => false);
  // La plateforme ne change jamais pendant la vie de la page : aucun
  // abonnement à poser, la fonction de désinscription suffit (même patron
  // que src/components/PricingModal.js pour estDansAppPlay).
  const plateforme = useSyncExternalStore(() => () => {}, () => detecterPlateforme(), () => "inconnu");

  /**
   * Déclenche la boîte de dialogue native. Ne fonctionne qu'une fois par
   * événement capturé — le navigateur en émettra un nouveau à la prochaine
   * visite si la personne referme sans installer.
   */
  const proposerInstallation = async () => {
    if (!evenementCapture) return null;
    evenementCapture.prompt();
    const choix = await evenementCapture.userChoice;
    evenementCapture = null;
    notifier();
    return choix.outcome; // "accepted" | "dismissed"
  };

  return {
    // true seulement quand le navigateur a réellement proposé
    // l'installation. Sur iOS, jamais — il n'existe pas d'événement à
    // capturer, le bouton se rabat sur des instructions.
    peutProposer: !!evenementDiffere,
    proposerInstallation,
    installee,
    plateforme,
  };
}
