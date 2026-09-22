/**
 * Aide affichée quand la localisation est refusée (CapturePosition.jsx).
 *
 * Pourquoi ce fichier existe : sur iOS Safari, `navigator.permissions` n'a
 * pas d'entrée "geolocation" (non supportée) — l'état affiché par
 * CapturePosition restait donc bloqué sur "inconnu" pour toujours, même
 * après un refus réel. Les instructions de déblocage (icône cadenas) ne
 * s'affichaient qu'après un état "denied" venant de cette API : sur iPhone,
 * elles n'apparaissaient donc JAMAIS, et la personne ne voyait qu'une ligne
 * d'erreur générique sans savoir quoi faire (signalé le 22/09/2026, vendeuse
 * bloquée sur iPhone lors de la configuration de sa boutique).
 *
 * Correctif : dès que le navigateur renvoie explicitement un refus
 * (`GeolocationPositionError.code === 1`, code PERMISSION_DENIED), on sait
 * avec certitude que c'est refusé — qu'on l'apprenne ou non via
 * `navigator.permissions` ensuite — et on affiche des instructions adaptées
 * à l'appareil plutôt qu'un unique texte pensé pour un ordinateur.
 */

/** true sur iPhone/iPad/iPod (Safari ou tout navigateur sur iOS — tous imposent WebKit). */
export function estAppareilIOS(userAgent) {
  return /iPad|iPhone|iPod/.test(userAgent || "");
}

/**
 * @param {{ userAgent: string, entite?: string }} p
 * @returns {{ titre: string, etapes: string[] }}
 */
export function aideLocalisationRefusee({ userAgent, entite = "boutique" }) {
  if (estAppareilIOS(userAgent)) {
    return {
      titre: "La localisation est bloquée pour ce site",
      etapes: [
        "Ouvrez l'app Réglages de l'iPhone (l'icône grise avec des rouages).",
        "Faites défiler jusqu'à Safari, puis touchez Localisation.",
        "Choisissez « Lors de l'utilisation de l'app » ou « Autoriser ».",
        `Revenez sur cette page et touchez à nouveau le bouton pour positionner votre ${entite}.`,
      ],
    };
  }
  return {
    titre: "La localisation est bloquée pour ce site",
    etapes: [
      "Touchez le cadenas (ou l'icône ⓘ) à côté de l'adresse du site.",
      "Autorisez la position pour ce site.",
      `Revenez ici et touchez à nouveau le bouton pour positionner votre ${entite}.`,
    ],
  };
}
