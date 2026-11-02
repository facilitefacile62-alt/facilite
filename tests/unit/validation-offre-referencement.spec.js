const { test, expect } = require("@playwright/test");

const charger = () => import("../../src/lib/validationOffreReferencement.js");
const description = "Description réelle du poste : missions, profil recherché et façon de postuler, assez longue pour être une vraie annonce lisible par Google.";
const bonne = { title: "Assistant(e) de direction", company: "SYSCOM INSTITUT", description, deadline: "2099-12-31" };

test("une offre complète passe", async () => {
  const { problemesReferencement } = await charger();
  expect(problemesReferencement(bonne)).toEqual([]);
});

test("titre générique, employeur générique et description courte sont refusés", async () => {
  const { problemesReferencement } = await charger();
  expect(problemesReferencement({ ...bonne, title: "Opportunité de recrutement" })).toHaveLength(1);
  expect(problemesReferencement({ ...bonne, title: "" })).toHaveLength(1);
  expect(problemesReferencement({ ...bonne, company: "Entreprise" })).toHaveLength(1);
  expect(problemesReferencement({ ...bonne, company: "" })).toHaveLength(1);
  expect(problemesReferencement({ ...bonne, description: "Courte." })).toHaveLength(1);
  expect(problemesReferencement({ title: "x", company: "", description: "" })).toHaveLength(3);
});

test("date limite : vide acceptée, invalide ou dépassée refusée", async () => {
  const { problemesReferencement } = await charger();
  expect(problemesReferencement({ ...bonne, deadline: "" })).toEqual([]);
  expect(problemesReferencement({ ...bonne, deadline: null })).toEqual([]);
  expect(problemesReferencement({ ...bonne, deadline: "demain" })).toHaveLength(1);
  expect(problemesReferencement({ ...bonne, deadline: "2020-01-01" })).toHaveLength(1);
  expect(problemesReferencement({ ...bonne, deadline: "2026-11-11" }, new Date("2026-11-11T10:00:00Z"))).toEqual([]);
});

test("le type de contrat n'est jamais inventé", async () => {
  const { contratPrecise } = await charger();
  expect(contratPrecise("")).toBeNull();
  expect(contratPrecise(undefined)).toBeNull();
  expect(contratPrecise("  ")).toBeNull();
  expect(contratPrecise("CDD")).toBe("CDD");
});

test("les éditeurs et la route de publication utilisent le contrôle et ne forcent plus « CDI »", async () => {
  const fs = require("fs");
  const lire = (p) => fs.readFileSync(p, "utf8");
  for (const p of ["src/app/admin/offres/page.js", "src/app/recruteur/page.js"]) {
    const c = lire(p);
    expect(c).toContain("problemesReferencement(");
    expect(c).not.toMatch(/contract_type: [^,\n]*\|\| "CDI"/);
  }
  expect(lire("src/app/api/admin/publish-offer/route.js")).toContain("problemesReferencement(body)");
});
