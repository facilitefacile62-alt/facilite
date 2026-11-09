// Contact externe d'une offre : e-mail personnel, WhatsApp, lien raccourci ou formulaire externe. Logique pure, sans dépendance réseau.
//
// Ces modes de candidature ne sont pas, en eux-mêmes, un signe de fraude : beaucoup de petites structures sérieuses recrutent ainsi. Mais Facilité ne peut pas
// les vérifier, et un lien raccourci masque sa destination. La fiche affiche donc une PRUDENCE neutre (jamais une accusation), sauf si le recruteur est vérifié.
import { resolveOfferAction } from "./offerContact.js";

export const MESSAGE_CONTACT_EXTERNE =
  "Contact externe, non vérifié par Facilité. Ne payez jamais pour postuler et ne communiquez pas d'informations bancaires.";

// Messageries gratuites grand public (adresse personnelle plutôt que d'entreprise).
const DOMAINES_COURRIEL_PERSONNEL = new Set([
  "gmail.com", "googlemail.com", "ymail.com", "rocketmail.com", "msn.com", "icloud.com", "me.com", "mac.com", "aol.com", "aol.fr",
  "protonmail.com", "protonmail.ch", "proton.me", "pm.me", "mail.com", "mail.ru", "free.fr", "orange.fr", "wanadoo.fr", "sfr.fr", "laposte.net", "bbox.fr",
]);
// Familles à extensions multiples : yahoo.fr, yahoo.com, hotmail.fr, outlook.fr, live.fr, gmx.net, yandex.ru…
const FAMILLES_COURRIEL_PERSONNEL = /^(?:yahoo|hotmail|outlook|live|gmx|yandex)\.[a-z.]{2,}$/;

const HOTES_WHATSAPP = ["wa.me", "wa.link", "whatsapp.com"];
const HOTES_RACCOURCIS = [
  "lnkd.in", "bit.ly", "bitly.com", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "v.gd", "cutt.ly", "rb.gy", "shorturl.at", "s.id", "buff.ly",
  "rebrand.ly", "tiny.cc", "t.ly", "linktr.ee",
];
const HOTES_FORMULAIRES = ["forms.gle", "forms.office.com", "forms.microsoft.com", "typeform.com", "jotform.com", "tally.so"];

const texte = (v) => (typeof v === "string" ? v.trim() : "");

/** Domaine d'une adresse e-mail ou d'un lien « mailto: » (en minuscules), ou "" si ce n'est pas une adresse. */
export function domaineCourriel(valeur) {
  const brut = texte(valeur).replace(/^mailto:/i, "").split("?")[0];
  const arobase = brut.lastIndexOf("@");
  if (arobase < 1) return "";
  return brut.slice(arobase + 1).trim().toLowerCase();
}

/** Nom d'hôte d'un lien (sans « www. », en minuscules) et son chemin, ou null si ce n'est pas un lien. */
export function analyserLien(valeur) {
  const brut = texte(valeur);
  if (!brut || /^mailto:/i.test(brut) || /\s/.test(brut)) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(brut) ? brut : `https://${brut}`);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return null;
    return { hote: u.hostname.toLowerCase().replace(/^www\./, ""), chemin: u.pathname.toLowerCase() };
  } catch {
    return null;
  }
}

const dansListe = (hote, liste) => liste.some((d) => hote === d || hote.endsWith(`.${d}`));

export function estCourrielPersonnel(valeur) {
  const domaine = domaineCourriel(valeur);
  return Boolean(domaine) && (DOMAINES_COURRIEL_PERSONNEL.has(domaine) || FAMILLES_COURRIEL_PERSONNEL.test(domaine));
}

/** Catégorie d'un LIEN : "whatsapp", "lien_raccourci", "formulaire_externe", ou null. */
export function categorieLien(valeur) {
  const lien = analyserLien(valeur);
  if (!lien) return null;
  if (dansListe(lien.hote, HOTES_WHATSAPP)) return "whatsapp";
  if (dansListe(lien.hote, HOTES_RACCOURCIS)) return "lien_raccourci";
  if (dansListe(lien.hote, HOTES_FORMULAIRES) || (lien.hote === "docs.google.com" && lien.chemin.includes("/forms"))) return "formulaire_externe";
  return null;
}

/**
 * Faut-il afficher la prudence « contact externe » sur cette offre ?
 * Regarde les champs de contact et de candidature de l'offre (pas le texte libre de la description). Jamais pour un recruteur vérifié.
 * @returns {{ externe: boolean, motifs: string[] }} motifs parmi "email_personnel", "whatsapp", "lien_raccourci", "formulaire_externe"
 */
export function contactExterneNonVerifie(offre) {
  const motifs = new Set();
  if (!offre || offre.recruiterVerified === true) return { externe: false, motifs: [] };
  for (const champ of [offre.contact_email, offre.application_email, offre.recruiter_email, offre.external_link, offre.externalLink]) {
    if (estCourrielPersonnel(champ)) motifs.add("email_personnel");
  }
  for (const champ of [offre.external_link, offre.externalLink, offre.application_url, offre.apply_url]) {
    const categorie = categorieLien(champ);
    if (categorie) motifs.add(categorie);
  }
  // Champ WhatsApp renseigné : contact par messagerie.
  if (texte(offre.contact_whatsapp)) motifs.add("whatsapp");
  return { externe: motifs.size > 0, motifs: [...motifs] };
}

/**
 * La candidature se fait-elle réellement DANS Facilité (formulaire de candidature de la plateforme) ? Même règle que le bouton « Postuler » (resolveOfferAction) :
 * candidature interne ou par e-mail (le message est alors envoyé par Facilité) = oui ; portail officiel, lien externe ou WhatsApp = non.
 * Sert à JobPosting.directApply, qui ne doit valoir true que si c'est vrai.
 */
export function candidatureDansFacilite(offre) {
  const action = resolveOfferAction(offre || {});
  return action.type === "internal" || action.type === "email";
}
