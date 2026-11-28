// Quand une offre n'a pas d'adresse e-mail d'employeur valide, Facilité ne peut rien transmettre : le site ne propose pas « Envoyer ma
// candidature » et montre comment postuler directement chez l'employeur (lien, WhatsApp, téléphone). Logique pure, testée à part.
import { adresseValide, destinataireDepuisOffre, destinataireSpontane } from "./destinataireCandidature.js";
import { analyserLien } from "./contactExterne.js";
import { buildWhatsAppLink, normalizePhoneNumber } from "./offerContact.js";

const WHATSAPP = /(^|\/\/|\.)(wa\.me|wa\.link|whatsapp\.com)/i;
const versHttps = (v) => (/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`);

/** Les moyens de postuler hors de Facilité que l'offre (ou la fiche de l'annuaire) indique, sans doublon. */
export function moyensDirects(offre, fiche = null) {
  const moyens = [];
  const ajouter = (type, url, libelle) => {
    if (url && !moyens.some((m) => m.url === url)) moyens.push({ type, url, libelle });
  };

  for (const champ of [offre?.application_url, offre?.external_link, offre?.externalLink, fiche?.externalLink]) {
    const valeur = typeof champ === "string" ? champ.trim() : "";
    if (!valeur) continue;
    if (/^mailto:/i.test(valeur)) {
      const adresse = adresseValide(valeur.split("?")[0]);
      if (adresse) ajouter("email", `mailto:${adresse}`, `Écrire à ${adresse}`);
      continue;
    }
    if (!analyserLien(valeur)) continue;
    if (WHATSAPP.test(valeur)) ajouter("whatsapp", versHttps(valeur), "Postuler sur WhatsApp");
    else ajouter("lien", versHttps(valeur), `Postuler sur ${analyserLien(valeur).hote}`);
  }

  const whatsapp = normalizePhoneNumber(offre?.contact_whatsapp || "");
  if (whatsapp && !moyens.some((m) => m.type === "whatsapp")) ajouter("whatsapp", buildWhatsAppLink(whatsapp, offre), "Postuler sur WhatsApp");

  const telephone = normalizePhoneNumber(offre?.contact_phone || "");
  if (telephone) ajouter("telephone", `tel:+${telephone}`, `Appeler le +${telephone}`);

  return moyens;
}

/** Offre de la base : « interne » seulement si elle a une adresse e-mail d'employeur valide (la même règle que le serveur). */
export function modeCandidatureOffre(offre) {
  return destinataireDepuisOffre(offre) ? { etat: "interne", moyens: [] } : { etat: "direct", moyens: moyensDirects(offre) };
}

/** Candidature hors base (spontanée de l'annuaire, anciennes offres statiques, vitrine) : même règle que le serveur. */
export function modeCandidatureHorsBase(annuaire, job) {
  if (!job?.recruiterId && destinataireSpontane(annuaire, job?.id, job?.company)) return { etat: "interne", moyens: [] };
  const id = String(job?.id ?? "").toLowerCase();
  const nom = String(job?.company ?? "").trim().toLowerCase();
  const fiche = annuaire.find((f) => String(f.id ?? "").toLowerCase() === id || String(f.company ?? "").trim().toLowerCase() === nom) || null;
  const propre = adresseValide(job?.contact_email || job?.recruiterEmail || "");
  const moyens = moyensDirects(job, fiche);
  if (propre) moyens.unshift({ type: "email", url: `mailto:${propre}`, libelle: `Écrire à ${propre}` });
  return { etat: "direct", moyens };
}

/**
 * Message en TEXTE renvoyé par le serveur quand Facilité ne peut rien transmettre : l'ancienne application mobile l'affiche tel quel.
 * Il dit que rien n'est parti et comment postuler (site, WhatsApp, numéro ou e-mail indiqués par l'employeur).
 */
export function messageSansAdresse(moyens = []) {
  const enTexte = moyens.map((m) => {
    if (m.type === "telephone") return `téléphone : ${m.url.replace(/^tel:/, "")}`;
    if (m.type === "email") return `e-mail : ${m.url.replace(/^mailto:/, "")}`;
    if (m.type === "whatsapp") {
      const numero = m.url.match(/(?:wa\.me\/|phone=)\+?(\d{8,15})/i);
      return `WhatsApp : ${numero ? `+${numero[1]}` : m.url}`;
    }
    return `site : ${m.url}`;
  });
  const debut = "Facilité ne peut pas transmettre cette candidature : l'offre n'a pas d'adresse e-mail. Rien n'a été envoyé.";
  return enTexte.length
    ? `${debut} Postulez directement — ${enTexte.join(" ; ")}. Ne payez jamais pour postuler.`
    : `${debut} Regardez l'affiche et la description de l'offre.`;
}
