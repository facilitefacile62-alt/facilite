// Outils PDF de la page /fonctionnalites que l'application mobile ouvre DIRECTEMENT (sans repasser par la liste des outils du site).
// L'identifiant est contrôlé contre cette liste fermée avant d'être placé dans l'adresse : aucun chemin ni paramètre libre ne peut passer
// par le pont de session /auth/mobile-bridge.
export const OUTILS_PDF_DIRECTS = ["compresser-pdf", "fusionner-pdf", "diviser-pdf", "organiser-pdf", "jpg-en-pdf", "pdf-en-jpg"];

export const outilDirectValide = (outil) => typeof outil === "string" && OUTILS_PDF_DIRECTS.includes(outil);

/** Adresse de la page des outils : l'outil demandé s'ouvre d'emblée (?tool=), sinon la page seule. */
export const cheminFonctionnalites = (outil) => (outilDirectValide(outil) ? `/fonctionnalites?tool=${outil}` : "/fonctionnalites");
