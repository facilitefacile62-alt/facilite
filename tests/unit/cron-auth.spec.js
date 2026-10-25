const { test, expect } = require("@playwright/test");

/** Authentification Bearer des routes cron : plusieurs secrets acceptés, comparaison en temps constant. */
const charger = () => import("../../src/lib/cronAuth.js");

test.describe("bearerValide", () => {
  test("accepte l'un ou l'autre des secrets configurés", async () => {
    const { bearerValide } = await charger();
    const secrets = ["secret-cron-general", "secret-rattrapage"];
    expect(bearerValide("Bearer secret-cron-general", secrets)).toBe(true);
    expect(bearerValide("Bearer secret-rattrapage", secrets)).toBe(true);
  });

  test("refuse un secret inconnu, vide, mal formé ou absent", async () => {
    const { bearerValide } = await charger();
    const secrets = ["secret-cron-general", "secret-rattrapage"];
    expect(bearerValide("Bearer autre", secrets)).toBe(false);
    expect(bearerValide("Bearer ", secrets)).toBe(false);
    expect(bearerValide("secret-rattrapage", secrets)).toBe(false);
    expect(bearerValide("Basic secret-rattrapage", secrets)).toBe(false);
    expect(bearerValide("Bearer secret-rattrapage-plus-long", secrets)).toBe(false);
    expect(bearerValide(null, secrets)).toBe(false);
    expect(bearerValide(undefined, secrets)).toBe(false);
  });

  test("un secret non configuré n'est jamais accepté, même s'il est vide côté requête", async () => {
    const { bearerValide } = await charger();
    expect(bearerValide("Bearer secret-cron-general", ["secret-cron-general", undefined])).toBe(true);
    expect(bearerValide("Bearer ", ["secret-cron-general", undefined, ""])).toBe(false);
    expect(bearerValide("Bearer undefined", [undefined])).toBe(false);
    expect(bearerValide("Bearer x", [])).toBe(false);
    expect(bearerValide("Bearer x", undefined)).toBe(false);
  });
});
