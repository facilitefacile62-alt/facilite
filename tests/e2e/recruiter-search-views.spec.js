const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

/**
 * Section 7 du chantier RBAC : candidats_recherche et match_resumes
 * reconstruites sur has_badge('verified_recruiter') au lieu de
 * role='recruteur' (valeur disparue). Contre l'API réelle.
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

test.describe("RBAC — reconstruction candidats_recherche / match_resumes", () => {
  let candidateClient;
  let adminClient;
  let candidateId;
  let requestId;

  test.beforeAll(async () => {
    const env = loadEnvLocal();
    candidateClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    const { data: candAuth, error: candErr } = await candidateClient.auth.signInWithPassword({
      email: CANDIDATE_EMAIL,
      password: CANDIDATE_PASSWORD,
    });
    expect(candErr).toBeNull();
    candidateId = candAuth.user.id;

    const { error: adminErr } = await adminClient.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    expect(adminErr).toBeNull();
  });

  test.afterAll(async () => {
    // Retire le badge (revoke_badge, RPC admin) et nettoie la demande de test.
    if (adminClient && candidateId) {
      await adminClient.rpc("revoke_badge", {
        target_user_id: candidateId,
        badge_name: "verified_recruiter",
        reason: "Nettoyage post-test",
      });
    }
    if (adminClient && requestId) {
      await adminClient.from("badge_requests").delete().eq("id", requestId);
    }
  });

  test("un compte 'user' sans badge verified_recruiter n'a accès à aucun candidat", async () => {
    const { data, error } = await candidateClient.from("candidats_recherche").select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  test("un compte 'user' avec le badge verified_recruiter (via approve_badge_request) accède au répertoire", async () => {
    const { data: created, error: insertError } = await candidateClient
      .from("badge_requests")
      .insert({
        user_id: candidateId,
        requested_badge: "verified_recruiter",
        company_name: "Test Vue SARL",
        ninea_number: "1112223334445",
        rccm_number: "SN.DKR.2026.A.11111",
      })
      .select()
      .single();
    expect(insertError, `Insertion demande échouée : ${insertError?.message}`).toBeNull();
    requestId = created.id;

    const { data: approved, error: approveError } = await adminClient.rpc("approve_badge_request", {
      request_id: requestId,
    });
    expect(approveError).toBeNull();
    expect(approved).toBe(true);

    const { data, error } = await candidateClient.from("candidats_recherche").select("*");
    expect(error).toBeNull();
    expect(data.length, "Un recruteur vérifié ne voit aucun candidat.").toBeGreaterThan(0);

    // Le titulaire du badge ne doit jamais apparaître dans sa propre
    // recherche (il n'est plus 'candidat' au sens produit).
    expect(data.some((c) => c.id === candidateId)).toBe(false);
  });
});
