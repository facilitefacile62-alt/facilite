const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const racine = path.resolve(__dirname, "../..");
const lire = (p) => fs.readFileSync(path.join(racine, p), "utf-8").replace(/\r\n/g, "\n");

test("fiche d'une offre : la base décide de la visibilité avant que la copie de secours soit servie", () => {
  const page = lire("src/app/offres/[id]/page.js");
  // La copie n'est servie sans lire la base que pour un identifiant qui n'est pas un UUID (aucune ligne en base).
  expect(page).toContain("if (secours && !isUuid) {");
  const refus = page.indexOf("if (!peutVoirOffreNonValidee({ recruteurId, visiteur })) return null;");
  const copie = page.indexOf("if (secours) {\n          return nettoyerOffreAffichee(");
  expect(refus).toBeGreaterThan(-1);
  expect(copie).toBeGreaterThan(refus);
  expect(page).toContain("status: data.status, is_active: data.is_active, recruiterVerified: false");
});
