// Détection des doublons d'offres. Logique pure, sans dépendance : elle ne lit ni n'écrit rien en base et ne retire aucune offre.
//
// RÈGLE : deux offres sont des doublons SEULEMENT si les trois conditions sont réunies :
//   1. le titre normalisé est identique (casse, accents, ponctuation et espaces ignorés) ;
//   2. la ville est la même (normalisée) ;
//   3. le lien OU le contact de candidature est identique, et renseigné des deux côtés.
// Un même recruteur peut publier plusieurs postes sous le même titre avec des liens de candidature différents (cas réel : Global Talent HR et ses liens Zoho
// distincts) : ce ne sont PAS des doublons, et aucun avertissement ne doit s'afficher. Si le lien ou le contact manque d'un côté, on ne peut pas conclure : pas
// de doublon non plus (on préfère ne pas avertir à tort).
//
// L'incohérence entre le titre et la description (un texte commun à plusieurs postes d'un même recrutement) n'est PAS un critère ici.

const sansAccent = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Titre réduit à une forme comparable : minuscules, sans accents, sans ponctuation, espaces simples. */
export function normaliserTitre(titre) {
  return sansAccent(titre)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Ville d'un lieu libre (« Dakar, Sénégal » → « dakar ») : premier élément avant une virgule, une barre oblique, « & » ou une parenthèse. */
export function normaliserVille(lieu) {
  return normaliserTitre(String(lieu ?? "").split(/[,/&(]/)[0]);
}

/** Forme comparable d'un lien : sans protocole, sans « www. », sans paramètres ni ancre (« ?source=CareerSite »), sans « / » final, en minuscules. */
function formeLien(valeur) {
  const brut = String(valeur ?? "").trim();
  if (!brut || /\s/.test(brut)) return "";
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(brut) ? brut : `https://${brut}`);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return "";
    return `${u.hostname.toLowerCase().replace(/^www\./, "")}${decodeURIComponent(u.pathname).toLowerCase().replace(/\/+$/, "")}`;
  } catch {
    return "";
  }
}

function formeCourriel(valeur) {
  const brut = String(valeur ?? "").trim().replace(/^mailto:/i, "").split("?")[0].trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(brut) ? brut : "";
}

/**
 * Identifiants de candidature d'une offre : liens et contacts, normalisés (liste sans doublon, vide s'il n'y en a aucun).
 * Deux offres partagent la même candidature si leurs listes ont un élément en commun.
 */
export function identifiantsCandidature(offre) {
  const ids = new Set();
  for (const champ of [offre?.application_url, offre?.external_link, offre?.externalLink, offre?.apply_url]) {
    const lien = formeLien(champ);
    if (lien) ids.add(`lien:${lien}`);
    const mail = formeCourriel(champ); // external_link peut être un « mailto: »
    if (mail) ids.add(`mail:${mail}`);
  }
  for (const champ of [offre?.application_email, offre?.contact_email, offre?.recruiter_email]) {
    const mail = formeCourriel(champ);
    if (mail) ids.add(`mail:${mail}`);
  }
  for (const champ of [offre?.contact_whatsapp, offre?.contact_phone]) {
    const chiffres = String(champ ?? "").replace(/\D/g, "");
    if (chiffres.length >= 8) ids.add(`tel:${chiffres}`);
  }
  return [...ids];
}

/** Ces deux offres sont-elles des doublons (même titre normalisé, même ville ET même lien ou contact de candidature) ? */
export function sontDoublons(a, b) {
  if (!a || !b) return false;
  const titre = normaliserTitre(a.title);
  if (!titre || titre !== normaliserTitre(b.title)) return false;
  if (normaliserVille(a.location) !== normaliserVille(b.location)) return false;
  const idsB = new Set(identifiantsCandidature(b));
  return identifiantsCandidature(a).some((id) => idsB.has(id));
}

/** Offres existantes qui sont des doublons de la nouvelle offre (l'offre elle-même, par identifiant, est ignorée). Liste vide : aucun avertissement. */
export function trouverDoublons(nouvelle, existantes) {
  return (Array.isArray(existantes) ? existantes : []).filter((o) => o && (nouvelle?.id == null || o.id !== nouvelle.id) && sontDoublons(nouvelle, o));
}
