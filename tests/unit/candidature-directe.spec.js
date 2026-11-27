const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const racine = path.resolve(__dirname, "../..");
const lire = (p) => fs.readFileSync(path.join(racine, p), "utf-8");

test("sans adresse e-mail d'employeur : pas d'envoi interne, moyens directs de l'offre (lien, WhatsApp, téléphone)", async () => {
  const { modeCandidatureOffre } = await import("../../src/lib/moyensCandidature.js");
  expect(modeCandidatureOffre({ application_email: "rh@entreprise.sn" }).etat).toBe("interne");
  expect(modeCandidatureOffre({ contact_email: "contact@facilite.sn" }).etat).toBe("direct");

  const lien = modeCandidatureOffre({ application_url: "recrutement.exemple.sn/postuler", contact_phone: "77 123 45 67" });
  expect(lien.etat).toBe("direct");
  expect(lien.moyens.map((m) => m.type)).toEqual(["lien", "telephone"]);
  expect(lien.moyens[0].url).toBe("https://recrutement.exemple.sn/postuler");
  expect(lien.moyens[1].url).toBe("tel:+221771234567");

  const wa = modeCandidatureOffre({ external_link: "https://wa.me/221771234567", contact_whatsapp: "+221 77 123 45 67" });
  expect(wa.moyens.map((m) => m.type)).toEqual(["whatsapp"]);

  expect(modeCandidatureOffre({}).moyens).toEqual([]);
  // Un lien « javascript: » ou un texte libre n'est jamais proposé.
  expect(modeCandidatureOffre({ external_link: "javascript:alert(1)", application_url: "voir affiche" }).moyens).toEqual([]);
});

test("hors base : annuaire du serveur, sinon moyens directs ; une vitrine sans adresse n'envoie rien", async () => {
  const { modeCandidatureHorsBase } = await import("../../src/lib/moyensCandidature.js");
  const annuaire = [
    { id: "a", slug: "a", company: "Alpha", email: "rh@alpha.sn" },
    { id: "b", slug: "b", company: "Beta", externalLink: "https://jobs.beta.sn/" },
  ];
  expect(modeCandidatureHorsBase(annuaire, { id: "a", company: "Alpha", isSpontaneous: true }).etat).toBe("interne");
  const beta = modeCandidatureHorsBase(annuaire, { id: "b", company: "Beta", isSpontaneous: true });
  expect(beta.etat).toBe("direct");
  expect(beta.moyens.map((m) => m.url)).toEqual(["https://jobs.beta.sn/"]);
  expect(modeCandidatureHorsBase(annuaire, { id: "a", company: "Alpha", recruiterId: "x" }).etat).toBe("direct");
  expect(modeCandidatureHorsBase(annuaire, { id: 7, company: "Gamma", contact_email: "rh@gamma.sn" }).moyens[0].url).toBe("mailto:rh@gamma.sn");
});

test("le formulaire et l'extracteur ne proposent pas l'envoi quand Facilité ne peut rien transmettre", () => {
  const modale = lire("src/components/ApplyModal.jsx");
  expect(modale).toContain('modeCandidature.etat === "direct" ? (');
  expect(modale).toContain('if (modeCandidature.etat !== "interne") return;');
  // Aucune intention de candidature « envoyée plus tard » pour une offre sans adresse.
  expect(modale.indexOf('if (mode.etat !== "interne") return;')).toBeLessThan(modale.indexOf("await enregistrerIntentionCandidature"));
  const extracteur = lire("src/app/candidat/extracteur/page.js");
  expect(extracteur).toContain("if (posterOffer && !destinataireDepuisOffre(posterOffer)) return;");
  expect(extracteur).not.toContain("recruteur@entreprise.com");
});
