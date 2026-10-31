// Titres et descriptions des pages publiques pour les moteurs de recherche. Logique pure.
// Le modèle de titre du site (layout.js, « %s | Facilite ») ajoute la marque : les titres d'ici ne la contiennent donc JAMAIS.
// Un titre s'affiche en général sur 60 caractères environ : « marque » comprise (" | Facilite" = 11), il reste 49 caractères pour la page.

export const LONGUEUR_TITRE_PAGE = 49;
export const LONGUEUR_DESCRIPTION = 155;

const uneLigne = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const sansAccent = (s) => uneLigne(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const PICTOGRAMMES = /[\p{Extended_Pictographic}‍️⃣]/gu;

/** Coupe à la limite sur une fin de mot, avec « … » ; ne touche pas un texte qui tient déjà. */
export function tronquer(texte, max) {
  const t = uneLigne(texte);
  if (t.length <= max) return t;
  const coupe = t.slice(0, max - 1);
  const dernierEspace = coupe.lastIndexOf(" ");
  const base = dernierEspace > max * 0.5 ? coupe.slice(0, dernierEspace) : coupe;
  // Jamais de fin sur un petit mot (« … Sécurité à… ») : il ne veut rien dire seul.
  const sansMotVide = base.replace(/(?:\s+(?:à|de|du|des|d'|la|le|les|l'|et|ou|en|au|aux|un|une|pour|chez|dans|sur|par|avec))+$/iu, "");
  return `${sansMotVide.replace(/[\s,;:.\-–—(]+$/u, "")}…`;
}

/** Titre d'une offre : intitulé, suivi de l'entreprise seulement si l'intitulé ne la nomme pas déjà. */
export function titreOffre(offre, max = LONGUEUR_TITRE_PAGE) {
  const intitule = uneLigne(offre?.title) || "Offre d'emploi";
  const entreprise = uneLigne(offre?.company);
  const premierMot = sansAccent(entreprise).split(/[^a-z0-9]+/).find((m) => m.length > 0) || "";
  const dejaNommee = entreprise && (sansAccent(intitule).includes(sansAccent(entreprise)) || (premierMot.length >= 4 && sansAccent(intitule).includes(premierMot)));
  return tronquer(entreprise && !dejaNommee ? `${intitule} – ${entreprise}` : intitule, max);
}

/** Description d'une offre : texte de l'offre sans émoji ni marques de mise en forme, commençant par une lettre ou un chiffre. */
export function descriptionOffre(offre, max = LONGUEUR_DESCRIPTION) {
  const propre = uneLigne(String(offre?.description ?? "").replace(PICTOGRAMMES, " ").replace(/[#*•_]/g, " ")).replace(/^[^\p{L}\p{N}]+/u, "");
  const secours = `Offre d'emploi ${uneLigne(offre?.title)}${offre?.company ? ` chez ${uneLigne(offre.company)}` : ""}${offre?.location ? ` à ${uneLigne(offre.location)}` : ""}. Postulez en ligne sur Facilité.`;
  if (propre.length < 60) return tronquer(propre ? `${propre} ${secours}` : secours, max);
  return tronquer(propre, max);
}
