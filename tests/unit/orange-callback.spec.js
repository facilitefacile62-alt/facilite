const { test, expect } = require("@playwright/test");

/**
 * Callback Orange Money sans signature : jeton propre à la commande + confirmation serveur. Ces fonctions décident s'il
 * faut créditer, elles ne doivent JAMAIS laisser passer un paiement qui ne correspond pas à la commande.
 */
const charger = () => import("../../src/lib/orangeMoney.js");
const REF = "6f1d2a40-0000-4000-8000-000000000001";

test.describe("jeton de callback", () => {
  test("seul le bon jeton valide l'empreinte stockée", async () => {
    const { genererJetonCallback, jetonCallbackValide } = await charger();
    const { jeton, empreinte } = genererJetonCallback();
    expect(empreinte).toMatch(/^[0-9a-f]{64}$/);
    expect(jeton).not.toContain(empreinte);
    expect(jetonCallbackValide(jeton, empreinte)).toBe(true);
    expect(jetonCallbackValide(`${jeton}x`, empreinte)).toBe(false);
    expect(jetonCallbackValide(genererJetonCallback().jeton, empreinte)).toBe(false);
  });

  test("un jeton absent ou une empreinte absente ne valident jamais", async () => {
    const { genererJetonCallback, jetonCallbackValide } = await charger();
    const { jeton, empreinte } = genererJetonCallback();
    expect(jetonCallbackValide(null, empreinte)).toBe(false);
    expect(jetonCallbackValide(jeton, null)).toBe(false);
    expect(jetonCallbackValide(jeton, "pas-un-hash")).toBe(false);
  });
});

test.describe("secret global de l'URL fixe (version de secours)", () => {
  test("seul le bon secret passe, un secret absent ou non configuré jamais", async () => {
    const { secretCallbackGlobalValide } = await charger();
    expect(secretCallbackGlobalValide("s3cret-long-et-imprevisible", "s3cret-long-et-imprevisible")).toBe(true);
    expect(secretCallbackGlobalValide("autre", "s3cret-long-et-imprevisible")).toBe(false);
    expect(secretCallbackGlobalValide("", "s3cret-long-et-imprevisible")).toBe(false);
    expect(secretCallbackGlobalValide(null, "s3cret-long-et-imprevisible")).toBe(false);
    expect(secretCallbackGlobalValide("n-importe-quoi", undefined)).toBe(false);
    expect(secretCallbackGlobalValide(undefined, undefined)).toBe(false);
  });
});

test.describe("recherche de transaction (interface)", () => {
  test("sans identifiant de transaction Orange, échoue explicitement au lieu d'inventer un chemin", async () => {
    const { rechercherTransactionOrange } = await charger();
    await expect(rechercherTransactionOrange({ reference: REF, qrId: "qr-1" })).rejects.toThrow(/documentation Orange requise/);
  });
});

test.describe("confirmation Orange face à la commande", () => {
  const ok = { status: "SUCCESS", reference: REF, amount: { value: 5000, unit: "XOF" } };

  test("succès : statut, référence et montant identiques", async () => {
    const { evaluerConfirmationOrange } = await charger();
    expect(evaluerConfirmationOrange(ok, { reference: REF, montantXof: 5000 }).etat).toBe("succes");
    expect(evaluerConfirmationOrange({ ...ok, amount: 5000 }, { reference: REF, montantXof: 5000 }).etat).toBe("succes");
  });

  test("jamais de crédit si montant, référence ou devise diffèrent, ou sont absents", async () => {
    const { evaluerConfirmationOrange } = await charger();
    const cmd = { reference: REF, montantXof: 5000 };
    expect(evaluerConfirmationOrange({ ...ok, amount: { value: 50, unit: "XOF" } }, cmd).etat).toBe("incoherent");
    expect(evaluerConfirmationOrange({ ...ok, reference: "autre" }, cmd).etat).toBe("incoherent");
    expect(evaluerConfirmationOrange({ ...ok, amount: { value: 5000, unit: "EUR" } }, cmd).etat).toBe("incoherent");
    expect(evaluerConfirmationOrange({ status: "SUCCESS" }, cmd).etat).toBe("incoherent");
    expect(evaluerConfirmationOrange(ok, { reference: REF, montantXof: null }).etat).toBe("incoherent");
  });

  test("échec final, statut intermédiaire ou réponse vide : jamais un succès", async () => {
    const { evaluerConfirmationOrange } = await charger();
    const cmd = { reference: REF, montantXof: 5000 };
    expect(evaluerConfirmationOrange({ ...ok, status: "FAILED" }, cmd).etat).toBe("echec");
    expect(evaluerConfirmationOrange({ ...ok, status: "EXPIRED" }, cmd).etat).toBe("echec");
    expect(evaluerConfirmationOrange({ ...ok, status: "PENDING" }, cmd).etat).toBe("attente");
    expect(evaluerConfirmationOrange({}, cmd).etat).toBe("attente");
    expect(evaluerConfirmationOrange(null, cmd).etat).toBe("attente");
  });
});
