/**
 * Message affiché au recruteur après l'enregistrement d'une offre. Une offre créée par un recruteur reste « en attente de
 * modération » (status = pending_review) : invisible des candidats et non postulable tant qu'un administrateur ne l'a pas
 * validée. Le message le dit au lieu d'annoncer une publication qui n'a pas encore eu lieu.
 */
export function messagePublication(offre, messagePublie = "Offre publiée !") {
  return offre?.status && offre.status !== "approved"
    ? "Offre envoyée pour modération, elle sera visible après validation."
    : messagePublie;
}
