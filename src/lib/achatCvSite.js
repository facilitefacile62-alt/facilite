// Logique PURE de la page « Achat de CV » du site (sans React ni navigateur) : testable seule. Mêmes textes courts que l'application (maquette du 24/10/2026).

/** « 1 500 FCFA » (espace insécable comme séparateur de milliers). */
export function prixFcfa(prixXof) {
  const entier = Math.round(Number.isFinite(prixXof) ? prixXof : 0);
  return `${String(Math.abs(entier)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} FCFA`;
}

/** Une ligne de lister_modeles_cv() → un modèle ; une ligne illisible est ignorée (null). Aucun chemin de fichier n'existe dans ces lignes. */
export function lireModele(ligne) {
  if (!ligne || typeof ligne !== "object") return null;
  const prix = Number(ligne.prix_xof);
  const pages = Number(ligne.nb_pages);
  if (typeof ligne.id !== "string" || typeof ligne.nom !== "string" || !Number.isInteger(prix) || prix <= 0) return null;
  return {
    id: ligne.id,
    nom: ligne.nom,
    description: typeof ligne.description === "string" ? ligne.description : "",
    prixXof: prix,
    nbPages: Number.isInteger(pages) && pages > 0 ? pages : 0,
    achete: ligne.achete === true,
  };
}

export const texteBoutonApercu = (modele) => (modele.achete ? "Utiliser ce modèle" : `Acheter ce modèle · ${prixFcfa(modele.prixXof)}`);

export function textePage(page, total) {
  const t = Math.max(1, total);
  const p = Math.min(Math.max(1, Math.round(page) || 1), t);
  return `Page ${p} / ${t} · glissez ←→`;
}

/** Page affichée d'après le défilement horizontal (aimantation au centre). */
export function pageDepuisDecalage(decalage, largeurPas, total) {
  if (!(largeurPas > 0) || total < 1) return 1;
  return Math.min(total, Math.max(1, Math.round(decalage / largeurPas) + 1));
}

export const TEXTE_FILIGRANE = "APERÇU · FACILITÉ";

/** Motif répété du filigrane diagonal (SVG en image de fond) : posé PAR-DESSUS l'image d'aperçu, sans geste ni sélection possible. */
export function motifFiligrane() {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="120">` +
    `<text x="130" y="60" text-anchor="middle" transform="rotate(-30 130 60)" font-family="Arial, sans-serif" font-size="15" font-weight="900" letter-spacing="2" fill="rgba(17,24,39,0.20)">${TEXTE_FILIGRANE}</text>` +
    `</svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Adresse d'une page d'aperçu : seulement un UUID et une page de 1 à 10. */
export function adresseApercu(modeleId, page) {
  if (!UUID.test(String(modeleId)) || !Number.isInteger(page) || page < 1 || page > 10) return null;
  return `/api/cv-modeles/${modeleId}/apercu/${page}`;
}

/** Messages : vert (reçu), rouge (déjà en cours), gris (annulé, expiré). */
export function messageAchat(type, nomModele = "") {
  switch (type) {
    case "recu":
      return { texte: `Paiement reçu : le modèle « ${nomModele} » est à vous.`, couleur: "vert" };
    case "deja_prepare":
      return { texte: "Un paiement est déjà en cours pour ce modèle. Patientez quelques instants.", couleur: "rouge" };
    case "annule":
      return { texte: "Paiement annulé. Aucun montant n'a été débité.", couleur: "gris" };
    case "expire":
      return { texte: "Le QR code a expiré. Générez-en un nouveau.", couleur: "gris" };
    case "verification":
      return { texte: "Vérification de votre paiement auprès d'Orange Money…", couleur: "gris" };
    default:
      return null;
  }
}
