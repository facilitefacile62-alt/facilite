const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

/**
 * Section 4 du chantier RBAC : badge_requests, has_badge(),
 * approve/reject/revoke_badge(). Contre l'API réelle (clé anon), pas de
 * simulation.
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

test.describe("RBAC — badge_requests", () => {
  let candidateClient;
  let adminClient;
  let candidateId;
  let createdRequestIds = [];
  let approvedRequestId;

  test.beforeAll(async () => {
    const env = loadEnvLocal();
    candidateClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    const { data: candAuth, error: candErr } = await candidateClient.auth.signInWithPassword({
      email: CANDIDATE_EMAIL,
      password: CANDIDATE_PASSWORD,
    });
    expect(candErr, `Connexion candidat échouée : ${candErr?.message}`).toBeNull();
    candidateId = candAuth.user.id;

    const { error: adminErr } = await adminClient.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    expect(adminErr, `Connexion admin échouée : ${adminErr?.message}`).toBeNull();
  });

  test.afterAll(async () => {
    // Nettoyage : supprime les demandes de test créées, restaure badges=[].
    if (createdRequestIds.length > 0) {
      await adminClient.from("badge_requests").delete().in("id", createdRequestIds);
    }
    if (candidateId) {
      await adminClient.from("profiles").update({ badges: [] }).eq("id", candidateId);
    }
  });

  test("une demande verified_recruiter sans NINEA/RCCM est rejetée par la contrainte", async () => {
    const { error } = await candidateClient.from("badge_requests").insert({
      user_id: candidateId,
      requested_badge: "verified_recruiter",
      company_name: "Test SARL",
      // ninea_number / rccm_number volontairement absents
    });
    expect(error, "L'insertion a réussi sans NINEA/RCCM.").not.toBeNull();
    expect(error.message).toContain("verified_recruiter_requires_company_docs");
  });

  test("une demande complète est acceptée, et une seconde demande pending pour le même badge est bloquée", async () => {
    const { data, error } = await candidateClient
      .from("badge_requests")
      .insert({
        user_id: candidateId,
        requested_badge: "verified_recruiter",
        company_name: "Test SARL",
        ninea_number: "1234567890123",
        rccm_number: "SN.DKR.2026.A.00000",
        document_urls: [],
      })
      .select()
      .single();
    expect(error, `Insertion valide refusée : ${error?.message}`).toBeNull();
    createdRequestIds.push(data.id);

    const { error: dupError } = await candidateClient.from("badge_requests").insert({
      user_id: candidateId,
      requested_badge: "verified_recruiter",
      company_name: "Test SARL 2",
      ninea_number: "9999999999999",
      rccm_number: "SN.DKR.2026.A.99999",
    });
    expect(dupError, "Une deuxième demande pending pour le même badge a été acceptée.").not.toBeNull();
  });

  test("un utilisateur non admin/publisher ne peut pas approuver une demande", async () => {
    const { data: request } = await candidateClient
      .from("badge_requests")
      .select("id")
      .eq("user_id", candidateId)
      .eq("status", "pending")
      .single();

    const { error } = await candidateClient.rpc("approve_badge_request", { request_id: request.id });
    expect(error, "Un candidat a réussi à approuver sa propre demande.").not.toBeNull();
  });

  test("un admin approuve : statut, badges[], et security_logs mis à jour", async () => {
    const { data: request } = await adminClient
      .from("badge_requests")
      .select("id")
      .eq("user_id", candidateId)
      .eq("status", "pending")
      .single();

    const { data: approved, error } = await adminClient.rpc("approve_badge_request", { request_id: request.id });
    expect(error, `approve_badge_request a échoué : ${error?.message}`).toBeNull();
    expect(approved).toBe(true);
    // Capturé pour le test suivant (idempotence) : re-interroger par
    // user_id+status="approved" serait fragile, plusieurs lignes approuvées
    // pouvant légitimement s'accumuler pour ce compte au fil des runs.
    approvedRequestId = request.id;

    const { data: updatedRequest } = await adminClient
      .from("badge_requests")
      .select("status, reviewed_by")
      .eq("id", request.id)
      .single();
    expect(updatedRequest.status).toBe("approved");
    expect(updatedRequest.reviewed_by).toBeTruthy();

    const { data: hasIt } = await adminClient.rpc("has_badge", {
      check_user_id: candidateId,
      badge_name: "verified_recruiter",
    });
    expect(hasIt, "has_badge() ne reflète pas l'approbation.").toBe(true);

    const { data: logs } = await adminClient
      .from("security_logs")
      .select("event_type, target_user_id")
      .eq("target_user_id", candidateId)
      .eq("event_type", "badge_approved")
      .order("created_at", { ascending: false })
      .limit(1);
    expect(logs.length, "Aucun log security_logs créé pour l'approbation.").toBe(1);
  });

  test("re-approuver la même demande est un no-op idempotent (pas de doublon dans badges[])", async () => {
    const { data: result } = await adminClient.rpc("approve_badge_request", { request_id: approvedRequestId });
    expect(result, "Une demande déjà traitée a été réapprouvée.").toBe(false);

    const { data: profile } = await adminClient.from("profiles").select("badges").eq("id", candidateId).single();
    expect(profile.badges.filter((b) => b === "verified_recruiter").length).toBe(1);
  });

  test("un admin révoque le badge : has_badge() repasse à false, log 'badge_revoked' créé", async () => {
    const { data: revoked, error } = await adminClient.rpc("revoke_badge", {
      target_user_id: candidateId,
      badge_name: "verified_recruiter",
      reason: "Test automatisé — révocation",
    });
    expect(error, `revoke_badge a échoué : ${error?.message}`).toBeNull();
    expect(revoked).toBe(true);

    const { data: hasIt } = await adminClient.rpc("has_badge", {
      check_user_id: candidateId,
      badge_name: "verified_recruiter",
    });
    expect(hasIt).toBe(false);

    const { data: logs } = await adminClient
      .from("security_logs")
      .select("event_type")
      .eq("target_user_id", candidateId)
      .eq("event_type", "badge_revoked")
      .limit(1);
    expect(logs.length).toBe(1);
  });

  test("un candidat ne peut pas lire security_logs", async () => {
    const { data, error } = await candidateClient.from("security_logs").select("*").limit(1);
    expect(error).toBeNull();
    expect(data, "Un compte non-admin a pu lire security_logs.").toEqual([]);
  });
});
