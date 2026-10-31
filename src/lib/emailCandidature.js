// E-mail de candidature envoyé au recruteur : il se présente comme un message écrit par le CANDIDAT lui-même (objet, nom d'expéditeur, corps et signature), sans
// aucune mention de la plateforme. « Répondre » écrit directement au candidat. Logique pure, sans dépendance : testable seule.

const echapper = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** « de » devant une consonne, « d' » devant une voyelle ou un h : « poste de Technicien », « poste d'Agent de sécurité ». */
export const deElision = (mot) => (/^[aeiouyhàâäéèêëîïôöùûüœ]/i.test(String(mot ?? "").trim()) ? "d'" : "de ");

const uneLigne = (s) => String(s ?? "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();

/** Nom affiché d'un expéditeur : sans retour à la ligne, guillemets, barre oblique inverse ni chevrons (qui casseraient l'en-tête « De »). */
export function nomAffiche(nom) {
  return String(nom ?? "").replace(/[\r\n"<>\\]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

/** Adresse seule d'un expéditeur configuré : « Nom <a@b.c> » donne « a@b.c ». */
export function adresseSeule(expediteur) {
  const m = /<([^<>\s]+@[^<>\s]+)>/.exec(String(expediteur ?? ""));
  if (m) return m[1];
  const nue = String(expediteur ?? "").trim();
  return /^[^\s<>@]+@[^\s<>@]+$/.test(nue) ? nue : "";
}

/**
 * @param {{ nomCandidat: string, emailCandidat: string, poste: string, entreprise: string, message?: string, nomsPieces: string[], expediteur: string }} p
 * @returns {{ from: string, replyTo: string, subject: string, text: string, html: string }}
 */
export function construireEmailRecruteur(p) {
  const nom = nomAffiche(p.nomCandidat) || "Candidat";
  const adresse = adresseSeule(p.expediteur);
  const poste = uneLigne(p.poste);
  const entreprise = uneLigne(p.entreprise);
  const message = String(p.message ?? "").trim();
  const pieces = (p.nomsPieces || []).filter(Boolean);
  const emailCandidat = uneLigne(p.emailCandidat);
  const telephone = uneLigne(p.telephone);
  const ville = uneLigne(p.ville);
  const avecLettre = pieces.some((n) => /lettre|motivation/i.test(n));

  const lignes = ["Bonjour,", "", `Je me permets de vous adresser ma candidature pour le poste ${deElision(poste)}${poste}${entreprise ? ` au sein de ${entreprise}` : ""}.`, ""];
  if (message) lignes.push(message, "");
  if (pieces.length) {
    lignes.push(
      pieces.length === 1 ? "Vous trouverez en pièce jointe mon CV." : avecLettre ? "Vous trouverez en pièces jointes mon CV et ma lettre de motivation." : "Vous trouverez en pièces jointes mon CV et mes documents.",
      ""
    );
  }
  lignes.push(`Vous pouvez me répondre directement à cette adresse : ${emailCandidat}${telephone ? `, ou me joindre au ${telephone}` : ""}.`, "", "Cordialement,", "", nom);
  if (ville) lignes.push(ville);
  lignes.push(emailCandidat);
  const text = lignes.join("\n");

  const html =
    `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.55; color: #222;">` +
    lignes.map((l) => (l === "" ? "<br/>" : `<div>${echapper(l)}</div>`)).join("") +
    `</div>`;

  return {
    from: adresse ? `${nom} <${adresse}>` : nom,
    replyTo: emailCandidat,
    subject: `Candidature au poste ${deElision(poste)}${poste} – ${nom}`,
    text,
    html,
  };
}
