const { test, expect } = require("@playwright/test");

/** Redirections « ?next= » : uniquement des chemins internes, jamais une adresse qui mène hors du site. */
const charger = () => import("../../src/lib/destinationSure.js");

test.describe("destinationSure", () => {
  test("accepte les chemins internes, avec leur requête", async () => {
    const { destinationSure } = await charger();
    expect(destinationSure("/bienvenue")).toBe("/bienvenue");
    expect(destinationSure("/bienvenue?redirect=%2Foffres%2F1")).toBe("/bienvenue?redirect=%2Foffres%2F1");
    expect(destinationSure("/")).toBe("/");
  });

  test("refuse tout ce qui peut mener hors du site", async () => {
    const { destinationSure } = await charger();
    for (const mauvais of ["//evil.com", "/" + String.fromCharCode(92) + "evil.com", "https://evil.com", "http://evil.com/x", "javascript:alert(1)", "evil.com", "", null, undefined, 42, "/ok\nhttps://evil.com", "/a\u0000b"]) {
      expect(destinationSure(mauvais, "/defaut"), String(mauvais)).toBe("/defaut");
    }
  });

  test("valeur par défaut : « / » si rien n'est précisé", async () => {
    const { destinationSure } = await charger();
    expect(destinationSure("//evil.com")).toBe("/");
  });
});
