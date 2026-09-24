/**
 * Formats proposés au générateur d'affiches IA (recruteur + admin).
 *
 * Les dimensions viennent TOUJOURS d'ici, jamais du client : la route
 * /api/admin/generate-job-poster ne reçoit qu'un identifiant de format et
 * en déduit la taille. Sans cette liste blanche, n'importe quel appelant
 * pourrait demander une image de plusieurs dizaines de mégapixels au moteur
 * de rendu.
 *
 * Toutes les dimensions sont des multiples de 32, comme l'exige le modèle.
 */
export const FORMATS_AFFICHE = [
  { id: "1:1", libelle: "Carré", usage: "Publication classique", largeur: 1024, hauteur: 1024 },
  { id: "4:5", libelle: "Portrait", usage: "Fil d'actualité", largeur: 896, hauteur: 1120 },
  { id: "2:3", libelle: "Affiche", usage: "Affiche verticale", largeur: 832, hauteur: 1248 },
  { id: "9:16", libelle: "Story", usage: "Story / statut", largeur: 864, hauteur: 1536 },
  { id: "16:9", libelle: "Paysage", usage: "Bannière", largeur: 1536, hauteur: 864 },
];

export const FORMAT_AFFICHE_PAR_DEFAUT = "1:1";

/** Format demandé, ou le format par défaut si l'identifiant est absent ou inconnu. */
export function trouverFormatAffiche(id) {
  return (
    FORMATS_AFFICHE.find((f) => f.id === id) ||
    FORMATS_AFFICHE.find((f) => f.id === FORMAT_AFFICHE_PAR_DEFAUT)
  );
}

/** Identifiant utilisable dans un nom de fichier ("2:3" → "2x3"). */
export function idFormatPourFichier(format) {
  return String(format.id).replace(":", "x");
}
