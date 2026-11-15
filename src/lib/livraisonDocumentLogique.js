// Livraison d'un document à un candidat (panneau « Livrer un document au candidat » de l'administration) : règles PURES, sans import, testables seules.
//
// Problème du 15/11/2026 : l'administrateur choisit le fichier, oublie le titre, clique sur « Livrer le document » : le site refusait avec un petit message qui disparaît au bout de 3 secondes,
// donc rien n'était envoyé (aucun fichier, aucune ligne de livraison, aucune notification) et personne ne le voyait. Maintenant : le titre est proposé d'après le nom du fichier, le bouton dit
// ce qui manque, et le résultat de la livraison reste affiché dans le panneau.

/** Longueur minimale du titre : c'est ce que le candidat verra dans « Mes documents ». */
export const TITRE_MIN = 3;

/** Titre proposé d'après le nom du fichier : sans l'extension, tirets bas et points remplacés par des espaces. « MAMADOU SOWcv (2).pdf » -> « MAMADOU SOWcv (2) ». */
export function titreDepuisNomFichier(nom) {
  if (typeof nom !== "string") return "";
  return nom
    .trim()
    .replace(/\.[A-Za-z0-9]{1,5}$/, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ce qui manque pour livrer : null si tout est prêt, sinon la phrase à afficher sous le bouton. */
export function manqueAvantLivraison(fichier, titre) {
  const sansTitre = String(titre ?? "").trim().length < TITRE_MIN;
  if (!fichier && sansTitre) return "Choisissez le fichier et donnez un titre (3 lettres au moins) pour pouvoir livrer.";
  if (!fichier) return "Choisissez le fichier à livrer.";
  if (sansTitre) return "Donnez un titre au document (3 lettres au moins) : c'est ce que le candidat verra.";
  return null;
}

/** Message affiché dans le panneau après la réponse du serveur (reste visible jusqu'à la prochaine action). */
export function messageApresLivraison(statut, nomCandidat) {
  const qui = nomCandidat ? ` chez ${nomCandidat}` : "";
  if (statut === "delivered") return { ok: true, texte: `Document déposé${qui}. Il apparaît dès maintenant dans son espace « Mes documents » et il a reçu une notification.` };
  return {
    ok: true,
    texte: `Son espace est plein${qui} : une demande lui est envoyée. Il choisit quel document remplacer, ou refuse. Rien n'est déposé avant sa réponse.`,
  };
}

export function messageErreurLivraison(erreur) {
  const detail = erreur && erreur.message ? erreur.message : "erreur inconnue";
  return { ok: false, texte: `Livraison impossible : ${detail}` };
}
