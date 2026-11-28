const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const racine = path.resolve(__dirname, "../..");
const lire = (p) => fs.readFileSync(path.join(racine, p), "utf-8");

test("seule une adresse réelle de l'offre est retenue ; ni domaine par défaut ni adresse de démonstration", async () => {
  const { adresseValide, destinataireDepuisOffre } = await import("../../src/lib/destinataireCandidature.js");
  expect(adresseValide(" RH@entreprise.sn ")).toBe("RH@entreprise.sn");
  expect(adresseValide("mailto:rh@entreprise.sn")).toBe("rh@entreprise.sn");
  for (const refusee of ["", null, "rh", "rh@entreprise", "contact@facilite.sn", "x@facilite-demo.local", "a@example.com", "a@b.sn c@d.sn"]) {
    expect(adresseValide(refusee), String(refusee)).toBeNull();
  }
  expect(destinataireDepuisOffre({ application_email: "candidature@a.sn", contact_email: "info@a.sn" })).toBe("candidature@a.sn");
  expect(destinataireDepuisOffre({ application_email: "", contact_email: "info@a.sn / autre@a.sn" })).toBe("info@a.sn");
  expect(destinataireDepuisOffre({ application_email: "contact@facilite.sn", contact_email: null })).toBeNull();
  expect(destinataireDepuisOffre(null)).toBeNull();
});

test("candidature spontanée : l'adresse vient de l'annuaire du serveur, jamais devinée", async () => {
  const { destinataireSpontane } = await import("../../src/lib/destinataireCandidature.js");
  const annuaire = [
    { id: "semi-sarl", slug: "semi-sarl", company: "SEMI SARL", email: "rh@semi.sn" },
    { id: "wave", slug: "wave", company: "Wave" },
  ];
  expect(destinataireSpontane(annuaire, "semi-sarl", "peu importe")).toBe("rh@semi.sn");
  expect(destinataireSpontane(annuaire, "123", "semi sarl")).toBe("rh@semi.sn");
  expect(destinataireSpontane(annuaire, "wave", "Wave")).toBeNull();
  expect(destinataireSpontane(annuaire, "inconnue", "Entreprise Inconnue")).toBeNull();
});

test("la route ignore l'adresse du navigateur, n'a plus de repli, et refuse sans rien enregistrer quand l'offre n'a pas d'adresse", () => {
  const route = lire("src/app/api/postuler/route.js");
  expect(route).not.toMatch(/formData\.get\(["']recruiterEmail["']\)/);
  expect(route).not.toContain("facilite.sn");
  expect(route).toContain("destinataire = destinataireDepuisOffre(offre);");
  expect(route).toContain("const finalRecruiterEmail = testRecipient || destinataire;");
  // Le refus (422, message en texte) précède TOUTE écriture : intention, fichier, CV, candidature.
  const refus = route.indexOf('code: "aucune_adresse", error: messageSansAdresse(moyens) }, { status: 422 }');
  expect(refus).toBeGreaterThan(-1);
  for (const ecriture of ['.from("candidature_intentions")', ".upload(", '.from("resumes")', '.from("candidatures")', "resend.emails.send"]) {
    const premiere = route.indexOf(ecriture);
    if (premiere !== -1) expect(refus, ecriture).toBeLessThan(premiere);
  }
  // Une seule déclaration d'UUID_RE : une seconde, plus bas, cassait la lecture en amont.
  expect(route.match(/const UUID_RE\b/g)).toHaveLength(1);
});

test("le message du serveur dit que rien n'est parti et donne le moyen de postuler en texte", async () => {
  const { messageSansAdresse, moyensDirects } = await import("../../src/lib/moyensCandidature.js");
  const message = messageSansAdresse(
    moyensDirects({ application_url: "https://recrutement.exemple.sn/postuler", contact_whatsapp: "77 000 00 00", contact_phone: "33 800 00 00" })
  );
  expect(message).toContain("Rien n'a été envoyé.");
  expect(message).toContain("site : https://recrutement.exemple.sn/postuler");
  expect(message).toContain("WhatsApp : +221770000000");
  expect(message).toContain("téléphone : +221338000000");
  expect(message).not.toContain("wa.me");
  expect(messageSansAdresse([])).toContain("Regardez l'affiche et la description de l'offre.");
});

test("le formulaire ne fabrique plus d'adresse et n'en envoie plus", () => {
  const modale = lire("src/components/ApplyModal.jsx");
  expect(modale).not.toContain("destinationEmail");
  expect(modale).not.toContain("@gmail.com");
  expect(modale).not.toMatch(/formData\.append\(["']recruiterEmail["']/);
});
