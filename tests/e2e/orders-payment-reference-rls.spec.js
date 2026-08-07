const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const { runPrivilegedSql } = require("../helpers/privilegedSql");

/**
 * Correctif du 2026-08-07 : `orders` n'avait aucune policy RLS UPDATE —
 * le GRANT UPDATE (payment_reference) posé par
 * 20260802250000_wave3_update_columns.sql ne pouvait donc jamais
 * s'exercer (RLS bloque tout, silencieusement, GRANT ou pas). Résultat :
 * payment_reference restait NULL sur 87/88 commandes en production.
 * 20260807150000_orders_owner_update_payment_reference_policy.sql ajoute
 * la policy manquante (propriétaire uniquement). Ce test prouve trois
 * choses distinctes, pas seulement que "ça marche" :
 *   1. Le propriétaire peut désormais écrire payment_reference (le bug
 *      est réellement corrigé).
 *   2. Le propriétaire ne peut TOUJOURS PAS écrire payment_status (le
 *      GRANT colonne de la vague 3 continue de faire son travail — la
 *      nouvelle policy n'a pas élargi l'accès au-delà de la seule colonne
 *      déjà autorisée).
 *   3. Un compte ne peut pas modifier la commande d'un autre (la policy
 *      est bien scopée par propriétaire, pas un accès général).
 */

function loadEnvLocal() {
  const envPath = path.resolve(__dirname, "../../.env.local");
  const content = fs.readFileSync(envPath, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

const CANDIDATE_EMAIL = process.env.E2E_CANDIDATE_EMAIL || "e2e-test-candidate@facilite-demo.local";
const CANDIDATE_PASSWORD = process.env.E2E_CANDIDATE_PASSWORD || "FaciliteE2ETest2026!";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "e2e-test-admin@facilite-demo.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "FaciliteE2ETest2026!";

test.describe("orders — policy RLS UPDATE scopée à payment_reference", () => {
  let candidateClient;
  let adminClient;
  let candidateOrderId;
  let othersOrderId;

  test.beforeAll(async () => {
    const env = loadEnvLocal();
    candidateClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    const { data: candAuth, error: candErr } = await candidateClient.auth.signInWithPassword({
      email: CANDIDATE_EMAIL,
      password: CANDIDATE_PASSWORD,
    });
    expect(candErr, `Connexion candidat échouée : ${candErr?.message}`).toBeNull();

    const { data: adminAuth, error: adminErr } = await adminClient.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    expect(adminErr, `Connexion admin échouée : ${adminErr?.message}`).toBeNull();

    // Commande fixture appartenant à l'admin — sert de "commande d'autrui"
    // pour le candidat, insérée directement (pas besoin de repasser par
    // tout le flux checkout pour ce seul rôle de fixture).
    const rows = await runPrivilegedSql(
      `INSERT INTO public.orders (user_id, cv_model_id, amount, currency)
       VALUES ('${adminAuth.user.id}', 'modern', 1500, 'XOF')
       RETURNING id;`
    );
    othersOrderId = rows[0].id;

    const { data: order, error: orderError } = await candidateClient
      .from("orders")
      .insert({ user_id: candAuth.user.id, cv_model_id: "modern", amount: 1500, currency: "XOF" })
      .select()
      .single();
    expect(orderError, `Création de la commande candidat échouée : ${orderError?.message}`).toBeNull();
    candidateOrderId = order.id;
  });

  test.afterAll(async () => {
    if (candidateOrderId || othersOrderId) {
      const ids = [candidateOrderId, othersOrderId].filter(Boolean).map((id) => `'${id}'`).join(",");
      await runPrivilegedSql(`DELETE FROM public.orders WHERE id IN (${ids});`);
    }
  });

  test("le propriétaire peut mettre à jour payment_reference de sa propre commande", async () => {
    const { data, error } = await candidateClient
      .from("orders")
      .update({ payment_reference: "test-ref-12345" })
      .eq("id", candidateOrderId)
      .select();

    expect(error, `Mise à jour payment_reference refusée : ${error?.message}`).toBeNull();
    expect(data.length, "Aucune ligne mise à jour — la policy RLS UPDATE ne s'applique pas.").toBe(1);
    expect(data[0].payment_reference).toBe("test-ref-12345");
  });

  test("le propriétaire ne peut PAS mettre à jour payment_status de sa propre commande (GRANT colonne toujours restreint)", async () => {
    const { error } = await candidateClient
      .from("orders")
      .update({ payment_status: "paid" })
      .eq("id", candidateOrderId);

    expect(error, "Un candidat a réussi à modifier payment_status de sa propre commande.").not.toBeNull();
    expect(error.code).toBe("42501");

    const { data: unchanged } = await adminClient.from("orders").select("payment_status").eq("id", candidateOrderId).single();
    expect(unchanged.payment_status).toBe("pending");
  });

  test("un candidat ne peut pas modifier la commande d'un autre compte", async () => {
    const { data, error } = await candidateClient
      .from("orders")
      .update({ payment_reference: "hacked" })
      .eq("id", othersOrderId)
      .select();

    expect(error).toBeNull();
    expect(data, "Une commande appartenant à un autre compte a été modifiée.").toEqual([]);

    const { data: unchanged } = await adminClient.from("orders").select("payment_reference").eq("id", othersOrderId).single();
    expect(unchanged.payment_reference).toBeNull();
  });
});
