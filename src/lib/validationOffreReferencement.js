// Contrôle d'une offre AVANT publication, pour que la page de l'offre puisse émettre un JobPosting valide et honnête (règles Google pour les offres d'emploi).
// Logique pure, partagée par les deux éditeurs (admin et recruteur) et par la route de publication : une offre qui ne passe pas n'est pas publiée.
//  - titre : le nom réel du poste (pas un libellé générique) ;
//  - entreprise : le vrai nom de l'employeur (pas « Entreprise ») ;
//  - description : un vrai texte (Google exige une description complète) ;
//  - date limite : valide et non dépassée, quand elle est renseignée ;
//  - type de contrat : jamais inventé — vide quand l'annonce ne le dit pas (voir contratPrecise).

export const LONGUEUR_MIN_DESCRIPTION = 100;
const TITRES_GENERIQUES = /^(opportunit[ée] de recrutement|offre d['’]emploi|offre|recrutement|poste|annonce)$/i;
const ENTREPRISES_GENERIQUES = /^(entreprise|soci[ée]t[ée]|non pr[ée]cis[ée]e?|n\/?a|nc|inconnue?)$/i;
const DATE_SEULE = /^\d{4}-\d{2}-\d{2}$/;

/** Type de contrat tel que saisi, ou null s'il n'est pas précisé (jamais « CDI » par défaut : ce serait inventer une information). */
export function contratPrecise(valeur) {
  const t = String(valeur ?? "").trim();
  return t || null;
}

/** Liste de messages (français) décrivant ce qui empêche un référencement correct ; vide = l'offre peut être publiée. */
export function problemesReferencement(offre, maintenant = new Date()) {
  const problemes = [];
  const titre = String(offre?.title ?? "").trim();
  if (titre.length < 5 || TITRES_GENERIQUES.test(titre)) problemes.push("Le titre doit être le nom réel du poste (par exemple « Assistant(e) de direction »).");
  const entreprise = String(offre?.company ?? "").trim();
  if (entreprise.length < 2 || ENTREPRISES_GENERIQUES.test(entreprise)) problemes.push("Indiquez le vrai nom de l'employeur.");
  const description = String(offre?.description ?? "").trim();
  if (description.length < LONGUEUR_MIN_DESCRIPTION) problemes.push(`La description est trop courte (${description.length} caractères sur ${LONGUEUR_MIN_DESCRIPTION} au minimum) : décrivez le poste, le profil et comment postuler.`);
  const limite = String(offre?.deadline ?? "").trim();
  if (limite) {
    const jour = limite.slice(0, 10);
    const fin = DATE_SEULE.test(jour) ? new Date(`${jour}T23:59:59.999Z`) : null;
    if (!fin || Number.isNaN(fin.getTime())) problemes.push("La date limite n'est pas une date valide.");
    else if (fin.getTime() < maintenant.getTime()) problemes.push("La date limite est déjà dépassée.");
  }
  return problemes;
}
