const { test, expect } = require("@playwright/test");

/**
 * Pont de session de l'app mobile (POST /auth/mobile-bridge) : seules les
 * cibles connues de la liste blanche serveur sont acceptées, l'identifiant
 * d'une offre doit être un UUID strict, et RIEN n'est ouvert sans jeton valide.
 * Localhost uniquement, aucun jeton réel.
 */

const UUID = "aaaaaaaa-0000-0000-0000-000000000001";

async function poster(request, champs) {
  return request.post("/auth/mobile-bridge", { form: champs, maxRedirects: 0 });
}

test.describe("Pont de session mobile : liste blanche", () => {
  test.setTimeout(120_000);

  test("cible inconnue refusée (400), y compris les clés du prototype", async ({ request }) => {
    for (const cible of ["inconnue", "constructor", "__proto__", "toString", "../admin", "/admin", ""]) {
      const r = await poster(request, { access_token: "x", refresh_token: "y", cible });
      expect(r.status(), `cible "${cible}"`).toBe(400);
    }
  });

  test("offre : identifiant absent ou non-UUID refusé (400), aucun chemin ne peut être injecté", async ({ request }) => {
    for (const id of [undefined, "", "abc", "../../admin", "1; DROP", `${UUID}/../admin`, `${UUID}?x=1`]) {
      const champs = { access_token: "x", refresh_token: "y", cible: "offre" };
      if (id !== undefined) champs.id = id;
      const r = await poster(request, champs);
      expect(r.status(), `id "${id}"`).toBe(400);
    }
  });

  test("cibles connues : acceptées jusqu'à la vérification du jeton, qui échoue (401) avec un faux jeton", async ({ request }) => {
    for (const cible of ["creer-cv", "mes-cvs", "candidatures", "securite", "facturation", "premium", "recruteur", "admin", "etablissements"]) {
      const r = await poster(request, { access_token: "faux.jeton.bidon", refresh_token: "faux", cible });
      expect(r.status(), `cible "${cible}"`).toBe(401);
    }
    const offre = await poster(request, { access_token: "faux.jeton.bidon", refresh_token: "faux", cible: "offre", id: UUID });
    expect(offre.status()).toBe(401);
  });

  test("jetons manquants : refusé (400) avant toute vérification", async ({ request }) => {
    const r = await poster(request, { cible: "creer-cv" });
    expect(r.status()).toBe(400);
  });
});
