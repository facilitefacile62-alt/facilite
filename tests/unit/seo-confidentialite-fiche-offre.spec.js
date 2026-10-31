const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Fiche d'une offre : les données envoyées avec la page (lisibles dans son code source) ne contiennent ni l'identifiant du recruteur, ni le vecteur de recherche,
 * ni les compteurs internes. Les contacts saisis par le recruteur restent affichés. Le propriétaire est reconnu côté navigateur, après connexion.
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");
const col = () => import("../../src/lib/colonnesOffres.js");

test("colonnes de la fiche : aucune colonne interne, et tous les contacts affichés y figurent", async () => {
  const { COLONNES_FICHE_OFFRE, CHAMPS_INTERNES_OFFRE, SELECT_FICHE_OFFRE } = await col();
  for (const interne of CHAMPS_INTERNES_OFFRE) expect(COLONNES_FICHE_OFFRE, interne).not.toContain(interne);
  for (const contact of ["contact_email", "contact_phone", "contact_whatsapp", "external_link", "application_url", "application_email"]) {
    expect(COLONNES_FICHE_OFFRE, contact).toContain(contact);
  }
  expect(SELECT_FICHE_OFFRE).not.toMatch(/\*|embedding|recruiter_id/);
  expect(CHAMPS_INTERNES_OFFRE).toEqual(expect.arrayContaining(["recruiter_id", "embedding", "view_count"]));
});

test("retirerChampsInternes : retire les champs internes, garde le reste, ne modifie pas l'original", async () => {
  const { retirerChampsInternes } = await col();
  const o = { id: "1", title: "T", contact_email: "a@b.c", recruiter_id: "r", embedding: [1, 2], view_count: 9, is_test_account: false, status_updated_at: "x" };
  const p = retirerChampsInternes(o);
  expect(p).toEqual({ id: "1", title: "T", contact_email: "a@b.c" });
  expect(o.recruiter_id).toBe("r");
});

test("page de la fiche : colonnes explicites (plus de select *), recruiter_id lu seulement pour le badge puis retiré, offres de secours nettoyées aussi", () => {
  const p = lire("src/app/offres/[id]/page.js");
  expect(p).not.toContain('.select("*")');
  expect(p).toContain("`${SELECT_FICHE_OFFRE}, recruiter_id`");
  expect(p).toContain("const { recruiter_id: recruteurId, ...donneesPubliques } = data;");
  expect(p).toContain("return { ...retirerChampsInternes(donneesPubliques), recruiterVerified };");
  expect(p).toContain("retirerChampsInternes(FALLBACK_STATIC_OFFERS[strId])");
  expect(p).toContain("retirerChampsInternes(found)");
  expect(p).not.toMatch(/return \{ \.\.\.data,/);
});

test("propriétaire : reconnu côté navigateur après connexion (lecture de recruiter_id), plus depuis les données de la page ; l'affichage des contacts est inchangé", () => {
  const c = lire("src/app/offres/[id]/OffreDetailClient.js");
  expect(c).not.toContain("offer.recruiter_id");
  expect(c).toContain("const isOwner = userId && userId === recruteurId;");
  expect(c).toContain('.select("recruiter_id")');
  expect(c).toContain("if (!userId) return;");
  expect(c).toContain("mailto:${offer.contact_email}");
});
