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

test("la route ignore l'adresse du navigateur, n'a plus de repli et n'envoie rien sans adresse", () => {
  const route = lire("src/app/api/postuler/route.js");
  expect(route).not.toMatch(/formData\.get\(["']recruiterEmail["']\)/);
  expect(route).not.toContain("facilite.sn");
  expect(route).toContain("destinataireDepuisOffre(offreDestinataire)");
  expect(route).toContain("const finalRecruiterEmail = destinataire ? testRecipient || destinataire : null;");
  expect(route).toContain("if (!finalRecruiterEmail) {");
  expect(route).toContain('envoi: finalRecruiterEmail ? "email" : "aucune_adresse"');
  // Une seule déclaration d'UUID_RE : une seconde, plus bas, cassait la lecture en amont.
  expect(route.match(/const UUID_RE\b/g)).toHaveLength(1);
});

test("le formulaire ne fabrique plus d'adresse et n'en envoie plus", () => {
  const modale = lire("src/components/ApplyModal.jsx");
  expect(modale).not.toContain("destinationEmail");
  expect(modale).not.toContain("@gmail.com");
  expect(modale).not.toMatch(/formData\.append\(["']recruiterEmail["']/);
  expect(lire("src/lib/candidatureIntentions.js")).not.toContain("recruiter_email");
});
