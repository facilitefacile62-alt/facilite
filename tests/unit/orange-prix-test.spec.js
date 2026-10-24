const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Prix de test (1 FCFA par jeton) réservé à des comptes listés dans ORANGE_TEST_PRIX_USER_IDS, côté serveur seulement.
 * Variable absente ou vide, ou autre utilisateur : tarif configuré (100 FCFA par jeton) pour tout le monde.
 */
const charger = () => import("../../src/lib/prixTestOrange.js");
const MOI = "0b5cd0a1-6c3e-4b7e-9a11-2f8d4e6a7b90";
const AUTRE = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const TARIF = 100;

test.describe("prix de test réservé à des comptes", () => {
  test("variable absente, vide ou sans identifiant valide : 100 FCFA par jeton pour tout le monde", async () => {
    const { prixJetonFcfa, idsPrixTest } = await charger();
    for (const env of [{}, { ORANGE_TEST_PRIX_USER_IDS: "" }, { ORANGE_TEST_PRIX_USER_IDS: "   " }, { ORANGE_TEST_PRIX_USER_IDS: "pas-un-uuid, 123, true, *" }]) {
      expect(idsPrixTest(env)).toEqual([]);
      expect(prixJetonFcfa({ userId: MOI, tarifConfigureFcfa: TARIF, env })).toBe(100);
      expect(prixJetonFcfa({ userId: AUTRE, tarifConfigureFcfa: TARIF, env })).toBe(100);
    }
  });

  test("autre utilisateur : 100 FCFA par jeton, même quand la variable existe", async () => {
    const { prixJetonFcfa } = await charger();
    const env = { ORANGE_TEST_PRIX_USER_IDS: MOI };
    expect(prixJetonFcfa({ userId: AUTRE, tarifConfigureFcfa: TARIF, env })).toBe(100);
  });

  test("mon identifiant : 1 FCFA par jeton, donc 10 jetons = 10 FCFA et 100 jetons = 100 FCFA", async () => {
    const { prixJetonFcfa } = await charger();
    const env = { ORANGE_TEST_PRIX_USER_IDS: MOI };
    const prix = prixJetonFcfa({ userId: MOI, tarifConfigureFcfa: TARIF, env });
    expect(prix).toBe(1);
    expect(10 * prix).toBe(10);
    expect(100 * prix).toBe(100);
  });

  test("liste de plusieurs identifiants (virgules, espaces, majuscules) ; les valeurs invalides sont ignorées", async () => {
    const { aLePrixTest } = await charger();
    const env = { ORANGE_TEST_PRIX_USER_IDS: ` ${MOI.toUpperCase()} , n'importe quoi;${AUTRE} ` };
    expect(aLePrixTest(MOI, env)).toBe(true);
    expect(aLePrixTest(AUTRE, env)).toBe(true);
    expect(aLePrixTest("11111111-2222-4333-8444-555555555555", env)).toBe(false);
  });

  test("identifiant utilisateur absent ou invalide : jamais le prix de test", async () => {
    const { aLePrixTest } = await charger();
    const env = { ORANGE_TEST_PRIX_USER_IDS: MOI };
    for (const id of [undefined, null, "", "*", "0b5cd0a1", 42, { id: MOI }, [MOI]]) expect(aLePrixTest(id, env)).toBe(false);
  });

  test("lit process.env par défaut (variable posée puis retirée)", async () => {
    const { prixJetonFcfa } = await charger();
    delete process.env.ORANGE_TEST_PRIX_USER_IDS;
    expect(prixJetonFcfa({ userId: MOI, tarifConfigureFcfa: TARIF })).toBe(100);
    process.env.ORANGE_TEST_PRIX_USER_IDS = MOI;
    try {
      expect(prixJetonFcfa({ userId: MOI, tarifConfigureFcfa: TARIF })).toBe(1);
      expect(prixJetonFcfa({ userId: AUTRE, tarifConfigureFcfa: TARIF })).toBe(100);
    } finally {
      delete process.env.ORANGE_TEST_PRIX_USER_IDS;
    }
  });
});

test.describe("rien ne peut venir du navigateur ; seule la route des jetons est concernée", () => {
  const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");

  test("la route des jetons calcule le prix avec l'utilisateur authentifié côté serveur", () => {
    const route = lire("src/app/api/pay/jetons-checkout/route.js");
    expect(route).toContain("prixJetonFcfa({ userId: user.id, tarifConfigureFcfa: config.cout_jeton_fcfa })");
    // Le corps accepté du navigateur ne contient que la boutique et la quantité : aucun prix, identifiant ni drapeau de test.
    const schema = /const corpsSchema = z\.object\(\{([\s\S]*?)\}\);/.exec(route)[1];
    expect(schema).toContain("storeId");
    expect(schema).toContain("quantiteJetons");
    expect(schema.match(/^\s*\w+:/gm)).toHaveLength(2);
    // Le prix ne se lit nulle part dans le corps de la requête, les en-têtes ou l'adresse.
    expect(route).not.toMatch(/(body|corps|parseResult\.data|searchParams|headers\.get)[^\n]*(prix|test)/i);
    expect(route).not.toContain("process.env.ORANGE_TEST_PRIX_USER_IDS"); // lu uniquement dans prixTestOrange.js
  });

  test("la formation CV et les autres produits n'utilisent pas le prix de test", () => {
    expect(lire("src/app/api/pay/formation-cv-checkout/route.js")).not.toContain("prixTestOrange");
    expect(lire("src/lib/formationCvPaiement.js")).not.toContain("prixTestOrange");
    expect(lire("src/lib/jetonsPaiement.js")).not.toContain("prixTestOrange");
  });

  test("le webhook et le rattrapage vérifient le montant ENREGISTRÉ dans la commande (inchangés)", () => {
    expect(lire("src/app/api/pay/jetons-webhook/route.js")).toContain("montantXof: (commande) => commande.montant_xof");
    expect(lire("src/app/api/cron/rattrapage-achats-jetons/route.js")).toContain("montantXof: commande.montant_xof");
    expect(lire("src/app/api/pay/jetons-webhook/route.js")).not.toContain("prixTestOrange");
  });
});
