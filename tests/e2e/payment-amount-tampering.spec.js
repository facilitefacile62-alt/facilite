const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const { loadTestEnv } = require("../helpers/testEnv");

/**
 * Régression pour la faille de manipulation de montant trouvée lors de
 * l'audit sécurité (référentiel 101-150, points 123/144) : le flux de
 * recharge de crédits faisait confiance à `amount` envoyé par le client,
 * sans jamais le recalculer depuis un catalogue serveur — n'importe quel
 * utilisateur pouvait poster { amount: 1 } et obtenir un vrai lien de
 * paiement KPay à 1 XOF, crédité comme un forfait complet.
 */


const CANDIDATE_EMAIL = process.env.E2E_CANDIDATE_EMAIL || "e2e-test-candidate@facilite-demo.local";
const CANDIDATE_PASSWORD = process.env.E2E_CANDIDATE_PASSWORD || "FaciliteE2ETest2026!";

test.describe("Sécurité — manipulation du montant de paiement", () => {
  test.skip(!!process.env.TEST_SUPABASE_URL, "SKIP sur projet de test — clés KPay sandbox non configurées sur facilite-e2e-test");

  let supabase;
  let accessToken;
  let transactionId;

  test.beforeAll(async () => {
    const env = loadTestEnv();
    supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: CANDIDATE_EMAIL,
      password: CANDIDATE_PASSWORD,
    });
    expect(error, `Connexion candidat de test échouée : ${error?.message}`).toBeNull();
    accessToken = data.session.access_token;
  });

  test.afterAll(async () => {
    if (transactionId) {
      await supabase.from("transactions").delete().eq("id", transactionId);
    }
  });

  test("un montant falsifié dans le corps de la requête n'est jamais utilisé pour le paiement réel", async ({ request }) => {
    // 100 XOF : plancher imposé par src/lib/kpay.js lui-même (un montant
    // plus bas est rejeté avant d'atteindre la logique métier) — toujours
    // 50x moins que le vrai prix (5000 XOF), largement suffisant pour
    // prouver que le montant du client n'est pas recalculé côté serveur.
    const response = await request.post("/api/pay/checkout", {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { amount: 100, planName: "Premium — falsifié" },
    });

    expect(response.ok(), `Le checkout a échoué : ${await response.text()}`).toBe(true);
    const body = await response.json();
    transactionId = body.transactionId;
    expect(transactionId).toBeTruthy();

    const { data: transaction, error } = await supabase
      .from("transactions")
      .select("amount, metadata")
      .eq("id", transactionId)
      .single();

    expect(error).toBeNull();
    expect(
      transaction.amount,
      "Le montant falsifié (100) a été accepté au lieu du prix catalogue serveur (5000)."
    ).toBe(5000);
    expect(transaction.metadata?.plan_name).toBe("Premium");
  });
});
