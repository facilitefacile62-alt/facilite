const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Étape 5 : liens des offres ouvertes dans le HTML de /offres. Seules les offres actives, approuvées et non expirées ; aucune offre masquée ou expirée ;
 * aucun recruiter_id, numéro, contact ni donnée privée ; la liste interactive et la navigation ne changent pas.
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");
const mod = () => import("../../src/lib/offresOuvertes.js");
const J = 24 * 60 * 60 * 1000;
const NOW = Date.now();
const jour = (n) => new Date(NOW + n * J).toISOString().slice(0, 10);
const iso = (n) => new Date(NOW + n * J).toISOString();
const base = { company: "Alpha", location: "Dakar", status: "approved", is_active: true };

test("offres ouvertes : actives, approuvées, non expirées ; une offre masquée, expirée, clôturée ou arrivée au bout de sa validité n'a aucun lien", async () => {
  const { offresOuvertes } = await mod();
  const lignes = [
    { ...base, id: "ouverte-date", title: "Comptable", deadline: jour(10), created_at: iso(-5) },
    { ...base, id: "ouverte-sans-date", title: "Vendeur", deadline: null, created_at: iso(-10) },
    { ...base, id: "masquee", title: "Test masqué", is_active: false, deadline: jour(10), created_at: iso(-5) },
    { ...base, id: "expiree", title: "Expirée", deadline: jour(-3), created_at: iso(-30) },
    { ...base, id: "cloturee", title: "Clôturée", status: "closed", deadline: jour(10), created_at: iso(-5) },
    { ...base, id: "ancienne", title: "Ancienne sans date", deadline: null, created_at: iso(-90) },
    { ...base, id: "en-attente", title: "En attente", status: "pending", deadline: jour(10), created_at: iso(-5) },
    { ...base, id: "sans-titre", title: "  ", deadline: jour(10), created_at: iso(-5) },
  ];
  const ids = offresOuvertes(lignes).map((o) => o.id);
  expect(ids).toEqual(["ouverte-date", "ouverte-sans-date"]);
});

test("sortie : seulement id, intitulé, entreprise et lieu ; aucun contact, identifiant de recruteur ni autre champ, même si la ligne en contient", async () => {
  const { offresOuvertes } = await mod();
  const [o] = offresOuvertes([
    { ...base, id: "a", title: "Comptable", deadline: jour(5), created_at: iso(-1), recruiter_id: "uuid-recruteur", contact_email: "a@b.c", contact_phone: "+221770000000", contact_whatsapp: "770000000", embedding: [1, 2], view_count: 4 },
  ]);
  expect(Object.keys(o).sort()).toEqual(["company", "id", "location", "title"]);
  expect(JSON.stringify(o)).not.toMatch(/recruteur|a@b\.c|770000000|embedding|view_count/);
});

test("limite et ordre : cent liens au plus, dans l'ordre reçu (les plus récentes d'abord) ; entrée invalide sans effet", async () => {
  const { offresOuvertes, LIMITE_LIENS_OFFRES } = await mod();
  const beaucoup = Array.from({ length: 250 }, (_, i) => ({ ...base, id: `o${i}`, title: `Offre ${i}`, deadline: jour(10), created_at: iso(-1) }));
  const sortie = offresOuvertes(beaucoup);
  expect(sortie).toHaveLength(LIMITE_LIENS_OFFRES);
  expect(sortie[0].id).toBe("o0");
  expect(offresOuvertes(null)).toEqual([]);
  expect(offresOuvertes([null, undefined, {}])).toEqual([]);
});

test("colonnes lues : explicites, aucune colonne privée, aucun select *", async () => {
  const { COLONNES_LIENS_OFFRES, SELECT_LIENS_OFFRES } = await mod();
  for (const privee of ["recruiter_id", "embedding", "contact_email", "contact_phone", "contact_whatsapp", "application_email", "application_url", "external_link", "view_count", "is_test_account"]) {
    expect(COLONNES_LIENS_OFFRES, privee).not.toContain(privee);
  }
  expect(SELECT_LIENS_OFFRES).not.toMatch(/\*/);
  const serveur = lire("src/lib/offresOuvertesServeur.js");
  expect(serveur).not.toMatch(/select=\*/);
  expect(serveur).toContain("select=${SELECT_LIENS_OFFRES}&is_active=eq.true");
  expect(serveur).toContain("return [];");
});

test("page /offres : liste interactive inchangée, liens rendus côté serveur dessous ; composant sans donnée privée ; navigation principale intacte", () => {
  const p = lire("src/app/offres/page.js");
  expect(p).toContain("<OffresClient />");
  expect(p).toContain("<OffresOuvertesLiens offres={offresOuvertes} />");
  expect(p).toContain("export const metadata = {");
  const c = lire("src/app/offres/OffresOuvertesLiens.js");
  expect(c).not.toContain('"use client"');
  expect(c.replace(/^\s*\/\/.*$/gm, "")).not.toMatch(/recruiter|contact_|telephone|whatsapp|email|embedding/i);
  expect(c).toContain("href={`/offres/${o.id}`}");
  expect(lire("src/components/Header.jsx")).not.toMatch(/OffresOuvertesLiens|offresOuvertes/);
  expect(lire("src/app/offres/OffresClient.jsx")).not.toMatch(/OffresOuvertesLiens/);
});

test("le plan du site n'est pas touché par cette étape", () => {
  const s = lire("src/app/sitemap.js");
  expect(s).not.toMatch(/offresOuvertes|OffresOuvertes/);
});
