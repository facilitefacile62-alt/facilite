const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * E-mail de candidature reçu par le recruteur : il se présente comme un message écrit par le candidat (objet, nom d'expéditeur, corps, signature), sans aucune
 * mention de la plateforme ; « Répondre » écrit au candidat. L'e-mail de confirmation du candidat garde son nom.
 */
const racine = path.join(__dirname, "../..");
const lire = (p) => fs.readFileSync(path.join(racine, p), "utf8").replace(/\r\n/g, "\n");
const module_ = () => import("../../src/lib/emailCandidature.js");
const base = {
  nomCandidat: "Awa Diop",
  emailCandidat: "awa.diop@example.com",
  poste: "Agent de sécurité",
  entreprise: "Groupe Sahel Sécurité",
  message: "Bonjour, je suis très intéressée.\nJe suis disponible immédiatement.",
  nomsPieces: ["CV_Awa_Diop.pdf", "Lettre.pdf"],
  expediteur: "Facilite Recrutement <recrutement@ffacilite.com>",
};

test("objet, expéditeur et réponse : le nom du candidat, aucune marque dans l'objet ni dans le nom ; « Répondre » va au candidat", async () => {
  const { construireEmailRecruteur } = await module_();
  const m = construireEmailRecruteur(base);
  expect(m.subject).toBe("Candidature au poste d'Agent de sécurité – Awa Diop");
  expect(m.from).toBe("Awa Diop <recrutement@ffacilite.com>");
  expect(m.replyTo).toBe("awa.diop@example.com");
  expect(m.subject + m.from.split("<")[0]).not.toMatch(/facilit/i);
});

test("corps : message du candidat, pièces jointes, adresse de réponse, signature ; aucune mention de la plateforme (texte et HTML)", async () => {
  const { construireEmailRecruteur } = await module_();
  const m = construireEmailRecruteur(base);
  expect(m.text).toContain("Je me permets de vous adresser ma candidature pour le poste d'Agent de sécurité au sein de Groupe Sahel Sécurité.");
  expect(m.text).toContain("Bonjour, je suis très intéressée.\nJe suis disponible immédiatement.");
  expect(m.text).toContain("Vous trouverez en pièces jointes mon CV et ma lettre de motivation.");
  expect(construireEmailRecruteur({ ...base, nomsPieces: ["CV.pdf", "Diplome.pdf"] }).text).toContain("mon CV et mes documents");
  expect(m.text).toContain("Vous pouvez me répondre directement à cette adresse : awa.diop@example.com.");
  expect(m.text.trim().endsWith("Cordialement,\n\nAwa Diop\nawa.diop@example.com")).toBe(true);
  expect(m.text).not.toMatch(/facilit|plateforme/i);
  expect(m.html).not.toMatch(/facilit|plateforme|#10E688/i);
  expect(construireEmailRecruteur({ ...base, nomsPieces: ["CV.pdf"] }).text).toContain("Vous trouverez en pièce jointe mon CV.");
  expect(construireEmailRecruteur({ ...base, message: "" }).text).not.toContain("undefined");
});

test("élision : « d' » devant une voyelle ou un h, « de » devant une consonne", async () => {
  const { construireEmailRecruteur, deElision } = await module_();
  expect(deElision("Agent")).toBe("d'");
  expect(deElision("Hôtesse d'accueil")).toBe("d'");
  expect(deElision("Électricien")).toBe("d'");
  expect(deElision("Technicien")).toBe("de ");
  expect(construireEmailRecruteur({ ...base, poste: "Technicien réseau" }).subject).toBe("Candidature au poste de Technicien réseau – Awa Diop");
});

test("sécurité : le HTML est échappé, aucun retour à la ligne dans l'expéditeur ou l'objet (pas d'injection d'en-tête)", async () => {
  const { construireEmailRecruteur, nomAffiche } = await module_();
  const m = construireEmailRecruteur({ ...base, message: "<script>alert(1)</script> & \"salut\"", nomCandidat: 'Awa "Le Boss" <x@y.z>\r\nBcc: autre@example.com' });
  expect(m.html).not.toContain("<script>");
  expect(m.html).toContain("&lt;script&gt;");
  expect(m.from).not.toMatch(/[\r\n]/);
  expect(m.subject).not.toMatch(/[\r\n]/);
  expect(m.from.startsWith("Awa Le Boss x@y.z Bcc: autre@example.com <")).toBe(true);
  expect(nomAffiche("A\r\nB")).toBe("A B");
  expect(nomAffiche("")).toBe("");
});

test("adresse d'envoi : celle du domaine configuré (Nom <adresse> ou adresse seule) ; sans adresse valide, seulement le nom", async () => {
  const { adresseSeule, construireEmailRecruteur } = await module_();
  expect(adresseSeule("Facilite Recrutement <recrutement@ffacilite.com>")).toBe("recrutement@ffacilite.com");
  expect(adresseSeule("recrutement@ffacilite.com")).toBe("recrutement@ffacilite.com");
  expect(adresseSeule("n'importe quoi")).toBe("");
  expect(construireEmailRecruteur({ ...base, expediteur: "" }).from).toBe("Awa Diop");
});

test("téléphone et ville du profil du candidat : ajoutés à la phrase de réponse et à la signature quand ils existent ; sinon rien (pas de ligne vide ni « undefined »)", async () => {
  const { construireEmailRecruteur } = await module_();
  const avec = construireEmailRecruteur({ ...base, telephone: "+221 77 000 00 00", ville: "Dakar, Sénégal" });
  expect(avec.text).toContain("Vous pouvez me répondre directement à cette adresse : awa.diop@example.com, ou me joindre au +221 77 000 00 00.");
  expect(avec.text).toContain("Awa Diop\nDakar, Sénégal\nawa.diop@example.com");
  const sans = construireEmailRecruteur(base);
  expect(sans.text).toContain("à cette adresse : awa.diop@example.com.");
  expect(sans.text).not.toMatch(/undefined|null|joindre au/);
  expect(construireEmailRecruteur({ ...base, nomsPieces: ["CV_Awa.pdf", "Lettre_de_motivation_Awa.pdf"] }).text).toContain("mon CV et ma lettre de motivation");
});

test("la route de candidature utilise ce modèle pour le recruteur ; la confirmation du candidat est inchangée", () => {
  const r = lire("src/app/api/postuler/route.js");
  expect(r).toContain('import { construireEmailRecruteur } from "@/lib/emailCandidature";');
  expect(r).toContain("...emailRecruteur,");
  expect(r).toContain("telephone: telephoneCandidat,");
  expect(r).not.toContain("[Facilite] Candidature");
  expect(r).not.toContain("Nouvelle candidature reçue");
  expect(r).toContain("Confirmation de votre candidature :");
  expect(r).toContain("from: candidateSender,");
});
