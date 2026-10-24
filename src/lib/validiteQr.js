// Textes et calculs autour de la validité d'un QR Orange Money (5 minutes) : logique pure, partagée par les deux pages de paiement.

/** « valable 5 minutes » à partir d'une durée en secondes. */
export function texteValidite(secondes) {
  const minutes = Math.max(1, Math.round(Number(secondes) / 60));
  return `valable ${minutes} minute${minutes > 1 ? "s" : ""}`;
}

/** Secondes restantes avant la fin (jamais négatif). */
export const secondesRestantes = (finMs, maintenantMs) => Math.max(0, Math.ceil((finMs - maintenantMs) / 1000));

/** « 4:32 » à partir d'un nombre de secondes. */
export function formaterCompteARebours(secondes) {
  const s = Math.max(0, Math.floor(Number(secondes) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Phrase affichée quand le temps est écoulé. Sur téléphone elle désigne le bouton « Payer avec MAXIT » ; sur ordinateur, le bouton habituel
 * (dont le libellé est donné par l'appelant).
 */
export function phraseTempsEcoule(estMobile, libelleBoutonOrdinateur) {
  return `Le temps est écoulé. Touchez « ${estMobile ? "Payer avec MAXIT" : libelleBoutonOrdinateur} » pour recommencer.`;
}
