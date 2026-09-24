const { test, expect } = require("@playwright/test");
const { choixDejaFait, JOURS_COMPTE_ANCIEN } = require("../../src/lib/choixUnivers.js");

/**
 * Choix d'univers (/bienvenue) : jamais reproposé à un compte existant.
 * Cas signalé le 24/09/2026 : un ancien utilisateur avec boutique le revoyait
 * à chaque connexion Google.
 */

const JOUR = 24 * 3600 * 1000;
const MAINTENANT = Date.parse("2026-09-24T12:00:00Z");
const il_y_a = (ms) => new Date(MAINTENANT - ms).toISOString();

test.describe("choixDejaFait", () => {
  test("compte tout neuf sans repère : le choix doit s'afficher", () => {
    expect(choixDejaFait({ created_at: il_y_a(60_000), user_metadata: {} }, MAINTENANT)).toBe(false);
    expect(choixDejaFait({ created_at: il_y_a(3 * JOUR) }, MAINTENANT)).toBe(false);
  });

  test("compte ancien (plus de 7 jours) : jamais le choix", () => {
    expect(choixDejaFait({ created_at: il_y_a(8 * JOUR) }, MAINTENANT)).toBe(true);
    expect(choixDejaFait({ created_at: il_y_a(30 * JOUR), user_metadata: {} }, MAINTENANT)).toBe(true);
    expect(JOURS_COMPTE_ANCIEN).toBe(7);
  });

  test("limite exacte : 7 jours pile ne suffisent pas, un instant de plus oui", () => {
    expect(choixDejaFait({ created_at: il_y_a(7 * JOUR) }, MAINTENANT)).toBe(false);
    expect(choixDejaFait({ created_at: il_y_a(7 * JOUR + 1) }, MAINTENANT)).toBe(true);
  });

  test("choix déjà fait (onboarding_done) : jamais reproposé, même compte récent", () => {
    expect(choixDejaFait({ created_at: il_y_a(60_000), user_metadata: { onboarding_done: true } }, MAINTENANT)).toBe(true);
  });

  test("onboarding_done ne compte que s'il vaut exactement true", () => {
    for (const v of ["true", 1, "yes", null, false]) {
      expect(choixDejaFait({ created_at: il_y_a(60_000), user_metadata: { onboarding_done: v } }, MAINTENANT), String(v)).toBe(false);
    }
  });

  test("aucun utilisateur ou date illisible : on ne masque pas le choix", () => {
    expect(choixDejaFait(null, MAINTENANT)).toBe(false);
    expect(choixDejaFait(undefined, MAINTENANT)).toBe(false);
    expect(choixDejaFait({}, MAINTENANT)).toBe(false);
    expect(choixDejaFait({ created_at: "n'importe quoi" }, MAINTENANT)).toBe(false);
  });
});
