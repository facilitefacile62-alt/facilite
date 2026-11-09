// Titres et descriptions des pages publiques pour les moteurs de recherche. Logique pure.
// Le modèle de titre du site (layout.js, « %s | Facilite ») ajoute la marque : les titres d'ici ne la contiennent donc JAMAIS.
// Un titre s'affiche en général sur 60 caractères environ : « marque » comprise (" | Facilite" = 11), il reste 49 caractères pour la page.

import { nettoyerPourAffichage } from "./nettoyerTexteOffre.js";
import { villeDuLieu } from "./offreReferencement.js";
import { contratEstPrecise } from "./contratOffre.js";

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
  const intitule = uneLigne(nettoyerPourAffichage(offre?.title)) || "Offre d'emploi";
  const entreprise = uneLigne(offre?.company);
  const premierMot = sansAccent(entreprise).split(/[^a-z0-9]+/).find((m) => m.length > 0) || "";
  const dejaNommee = entreprise && (sansAccent(intitule).includes(sansAccent(entreprise)) || (premierMot.length >= 4 && sansAccent(intitule).includes(premierMot)));
  return tronquer(entreprise && !dejaNommee ? `${intitule} – ${entreprise}` : intitule, max);
}

/** Description d'une offre : texte de l'offre sans émoji ni marques de mise en forme, commençant par une lettre ou un chiffre. */
export function descriptionOffre(offre, max = LONGUEUR_DESCRIPTION) {
  const propre = uneLigne(String(nettoyerPourAffichage(offre?.description) ?? "").replace(PICTOGRAMMES, " ").replace(/[#*•_]/g, " ")).replace(/^[^\p{L}\p{N}]+/u, "");
  const secours = `Offre d'emploi ${uneLigne(nettoyerPourAffichage(offre?.title))}${offre?.company ? ` chez ${uneLigne(offre.company)}` : ""}${offre?.location ? ` à ${uneLigne(offre.location)}` : ""}. Postulez en ligne sur Facilité.`;
  if (propre.length < 60) return tronquer(propre ? `${propre} ${secours}` : secours, max);
  return tronquer(propre, max);
}

// ---------- Fiche d'une offre (/offres/<id>) ----------
// Titre : « {Intitulé} à {Ville} – {Entreprise} | Offre d'emploi », 60 caractères au plus. Ce titre est publié tel quel (title.absolute) : le modèle « %s | Facilite »
// du site n'est pas ajouté. Ce qui manque est OMIS (ville, entreprise), jamais remplacé par un texte vide ni par « Non spécifié ».
export const LONGUEUR_TITRE_FICHE = 60;
const SUFFIXE_TITRE_FICHE = " | Offre d'emploi";

function entrepriseDejaNommee(intitule, entreprise) {
  if (!entreprise) return false;
  const premierMot = sansAccent(entreprise).split(/[^a-z0-9]+/).find((m) => m.length > 0) || "";
  return sansAccent(intitule).includes(sansAccent(entreprise)) || (premierMot.length >= 4 && sansAccent(intitule).includes(premierMot));
}

/** Titre de la page d'une offre. Essaie d'abord intitulé + ville + entreprise ; sinon sans l'entreprise ; sinon l'intitulé seul ; sinon l'intitulé est coupé proprement (la ville est gardée si elle tient). */
export function titreFicheOffre(offre, max = LONGUEUR_TITRE_FICHE) {
  const intitule = uneLigne(nettoyerPourAffichage(offre?.title)) || "Offre d'emploi";
  const ville = villeDuLieu(offre?.location);
  const entreprise = uneLigne(offre?.company);
  const villeUtile = ville && !sansAccent(intitule).includes(sansAccent(ville));
  const avecVille = villeUtile ? `${intitule} à ${ville}` : intitule;
  const complet = `${avecVille}${entreprise && !entrepriseDejaNommee(intitule, entreprise) ? ` – ${entreprise}` : ""}${SUFFIXE_TITRE_FICHE}`;
  if (complet.length <= max) return complet;
  const sansEntreprise = `${avecVille}${SUFFIXE_TITRE_FICHE}`;
  if (sansEntreprise.length <= max) return sansEntreprise;
  // L'intitulé complet (le poste) passe avant la ville : on ne le coupe que si même seul il ne tient pas.
  if (`${intitule}${SUFFIXE_TITRE_FICHE}`.length <= max) return `${intitule}${SUFFIXE_TITRE_FICHE}`;
  const reserveVille = villeUtile ? ` à ${ville}`.length : 0;
  if (villeUtile && max - SUFFIXE_TITRE_FICHE.length - reserveVille >= 20) {
    return `${tronquer(intitule, max - SUFFIXE_TITRE_FICHE.length - reserveVille)} à ${ville}${SUFFIXE_TITRE_FICHE}`;
  }
  return `${tronquer(intitule, max - SUFFIXE_TITRE_FICHE.length)}${SUFFIXE_TITRE_FICHE}`;
}

/**
 * Méta-description de la page d'une offre, environ 150 caractères, construite avec les vraies données : « {Entreprise} recrute : {Intitulé} à {Ville}. Contrat : {contrat}. »
 * puis le début du texte de l'annonce (nettoyé). Entreprise, ville et contrat sont omis s'ils manquent (« Non spécifié » n'est jamais écrit).
 */
export function descriptionFicheOffre(offre, max = LONGUEUR_DESCRIPTION) {
  const intitule = uneLigne(nettoyerPourAffichage(offre?.title)) || "Offre d'emploi";
  const ville = villeDuLieu(offre?.location);
  const entreprise = uneLigne(offre?.company);
  const contrat = contratEstPrecise(offre?.contract_type) ? uneLigne(offre.contract_type) : "";
  const villeUtile = ville && !sansAccent(intitule).includes(sansAccent(ville));
  const tete = `${entreprise && !entrepriseDejaNommee(intitule, entreprise) ? `${entreprise} recrute : ` : ""}${intitule}${villeUtile ? ` à ${ville}` : ""}.`;
  const morceaux = [tete];
  if (contrat) morceaux.push(`Contrat : ${contrat}.`);
  let texte = uneLigne(String(nettoyerPourAffichage(offre?.description) ?? "").replace(PICTOGRAMMES, " ").replace(/[#*•_]/g, " ")).replace(/^[^\p{L}\p{N}]+/u, "");
  // Une annonce qui commence par répéter l'intitulé : on ne le redit pas dans la description.
  if (texte && sansAccent(texte.slice(0, intitule.length)) === sansAccent(intitule)) texte = texte.slice(intitule.length).replace(/^[\s!:.\-–—]+/u, "");
  const debut = morceaux.join(" ");
  if (texte && debut.length < max - 20) morceaux.push(texte);
  else if (!texte) morceaux.push("Postulez en ligne sur Facilité.");
  return tronquer(morceaux.join(" "), max);
}
