const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Le paiement Orange Money reste INVISIBLE et impossible tant que l'activation explicite (ORANGE_MONEY_ENABLED=true) n'est pas posée
 * ET que la configuration est complète. Désactivé par défaut.
 */
const COMPLET = { ORANGE_MONEY_CLIENT_ID: "a", ORANGE_MONEY_CLIENT_SECRET: "b", ORANGE_MONEY_MERCHANT_CODE: "123456" };
const charger = () => import("../../src/lib/orangeMoneyActif.js");

test.describe("interrupteur Orange Money", () => {
  test("désactivé par défaut, même avec toutes les clés", async () => {
    const { orangeMoneyActif } = await charger();
    expect(orangeMoneyActif({})).toBe(false);
    expect(orangeMoneyActif({ ...COMPLET })).toBe(false);
  });

  test("seule la valeur exacte « true » active, et seulement avec la configuration complète", async () => {
    const { orangeMoneyActif } = await charger();
    expect(orangeMoneyActif({ ...COMPLET, ORANGE_MONEY_ENABLED: "true" })).toBe(true);
    for (const v of ["TRUE", "1", "yes", "false", ""]) expect(orangeMoneyActif({ ...COMPLET, ORANGE_MONEY_ENABLED: v })).toBe(false);
    for (const manquante of Object.keys(COMPLET)) {
      const env = { ...COMPLET, ORANGE_MONEY_ENABLED: "true" };
      delete env[manquante];
      expect(orangeMoneyActif(env)).toBe(false);
    }
  });

  test("les routes de paiement et les deux pages passent par l'interrupteur", () => {
    const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");
    for (const p of ["src/app/api/pay/jetons-checkout/route.js", "src/app/api/pay/formation-cv-checkout/route.js"]) {
      expect(lire(p)).toContain("orangeMoneyActif()");
    }
    for (const p of ["src/app/premium/page.js", "src/app/formation-redaction-cv/page.js"]) {
      const s = lire(p);
      expect(s).toContain("orangeActif={orangeMoneyActif()}");
      expect(s).toContain('dynamic = "force-dynamic"');
    }
  });
});
