// Destinataire d'une candidature : TOUJOURS déterminé par le serveur, à partir de l'offre (ou de l'annuaire des candidatures spontanées),
// JAMAIS à partir d'une adresse envoyée par le navigateur. Aucun repli : sans adresse valide, la candidature est enregistrée dans la boîte
// de réception de l'offre et aucun e-mail ne part (décision du 27/11/2026, après des envois vers un domaine inexistant).

// Domaines qui ne reçoivent rien ou qui n'appartiennent à aucun employeur réel.
const DOMAINES_REFUSES = ["facilite.sn", "facilite-demo.local", "example.com", "example.org", "exemple.com", "test.com"];

/** L'adresse nettoyée si elle est utilisable, sinon null. */
export function adresseValide(valeur) {
  const brut = typeof valeur === "string" ? valeur.trim().replace(/^mailto:/i, "").replace(/[.;,]+$/, "") : "";
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(brut)) return null;
  const domaine = brut.split("@")[1].toLowerCase();
  if (DOMAINES_REFUSES.includes(domaine) || domaine.endsWith(".local") || domaine.endsWith(".invalid")) return null;
  return brut;
}

// Un champ peut contenir plusieurs adresses (« a@x.sn / b@y.sn ») : la première utilisable l'emporte.
function premiereAdresse(champ) {
  for (const morceau of String(champ || "").split(/[\s,;/|]+/)) {
    const adresse = adresseValide(morceau);
    if (adresse) return adresse;
  }
  return null;
}

/** Adresse de candidature d'une offre de la base : application_email, sinon contact_email. */
export function destinataireDepuisOffre(offre) {
  return premiereAdresse(offre?.application_email) || premiereAdresse(offre?.contact_email);
}

/**
 * Adresse d'une candidature spontanée, lue dans l'annuaire du SERVEUR : l'identifiant (ou, à défaut, le nom de l'entreprise) désigne la
 * fiche ; l'adresse vient d'elle seule.
 */
export function destinataireSpontane(annuaire, identifiant, entreprise) {
  const id = String(identifiant ?? "").trim().toLowerCase();
  const nom = String(entreprise ?? "").trim().toLowerCase();
  const fiche =
    (id && annuaire.find((f) => String(f.id ?? "").toLowerCase() === id || String(f.slug ?? "").toLowerCase() === id)) ||
    (nom && annuaire.find((f) => String(f.company ?? "").trim().toLowerCase() === nom)) ||
    null;
  return premiereAdresse(fiche?.email);
}
