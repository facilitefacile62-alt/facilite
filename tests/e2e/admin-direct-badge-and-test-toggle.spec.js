const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

/**
 * Partie C du chantier admin (2026-08-07) : attribution directe du badge
 * "Recruteur vérifié" et bascule du drapeau "Compte de test" depuis la
 * liste des comptes (grant_verified_recruiter_badge, set_test_account_flag —
 * 20260807110000_admin_direct_badge_and_test_account_toggle.sql). Même
 * exigence que pour badge-privilege-escalation.spec.js : un publisher ne
 * doit pas pouvoir appeler ces fonctions par appel RPC direct, pas
 * seulement être empêché par l'UI.
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
const PUBLISHER_EMAIL = process.env.E2E_PUBLISHER_EMAIL || "e2e-test-agent@facilite-demo.local";
const PUBLISHER_PASSWORD = process.env.E2E_PUBLISHER_PASSWORD || "FaciliteE2ETest2026!";

test.describe("Admin — attribution directe de badge et bascule compte de test", () => {
  let candidateClient;
  let adminClient;
  let publisherClient;
  let candidateId;
  let originalIsTestAccount;

  test.beforeAll(async () => {
    const env = loadEnvLocal();
    candidateClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    publisherClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

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

    const { data: pubAuth, error: pubErr } = await publisherClient.auth.signInWithPassword({
      email: PUBLISHER_EMAIL,
      password: PUBLISHER_PASSWORD,
    });
    expect(pubErr, `Connexion publisher échouée : ${pubErr?.message}`).toBeNull();

    const { data: pubRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", pubAuth.user.id)
      .single();
    expect(pubRole?.role, "Le compte de test publisher n'a pas role='publisher'.").toBe("publisher");

    const { data: candidateProfile } = await adminClient
      .from("profiles")
      .select("is_test_account")
      .eq("id", candidateId)
      .single();
    originalIsTestAccount = candidateProfile?.is_test_account ?? false;
  });

  test.afterAll(async () => {
    if (!adminClient || !candidateId) return;
    // Nettoyage : remet le candidat de test dans l'état trouvé au départ,
    // pas un état fixe arbitraire (au cas où il aurait déjà été marqué
    // compte de test avant ce fichier).
    await adminClient.rpc("revoke_badge", {
      target_user_id: candidateId,
      badge_name: "verified_recruiter",
      reason: "Nettoyage post-test",
    });
    await adminClient.rpc("set_test_account_flag", {
      target_user_id: candidateId,
      is_test: originalIsTestAccount,
      reason: "Nettoyage post-test — restauration de l'état initial",
    });
  });

  test("un publisher ne peut pas s'attribuer/attribuer le badge verified_recruiter via grant_verified_recruiter_badge", async () => {
    const { data, error } = await publisherClient.rpc("grant_verified_recruiter_badge", {
      target_user_id: candidateId,
      reason: "Tentative non autorisée",
    });
    expect(error, "Un publisher a réussi à appeler grant_verified_recruiter_badge().").not.toBeNull();
    expect(data == null || data === false).toBe(true);

    const { data: profile } = await adminClient.from("profiles").select("badges").eq("id", candidateId).single();
    expect(
      profile.badges || [],
      "Le badge a été accordé malgré le rejet de l'appel publisher."
    ).not.toContain("verified_recruiter");
  });

  test("un publisher ne peut pas basculer is_test_account via set_test_account_flag", async () => {
    const { data, error } = await publisherClient.rpc("set_test_account_flag", {
      target_user_id: candidateId,
      is_test: true,
      reason: "Tentative non autorisée",
    });
    expect(error, "Un publisher a réussi à appeler set_test_account_flag().").not.toBeNull();
    expect(data == null || data === false).toBe(true);
  });

  test("un candidat ne peut pas s'auto-attribuer le badge ni se marquer compte de test", async () => {
    const { error: grantError } = await candidateClient.rpc("grant_verified_recruiter_badge", {
      target_user_id: candidateId,
      reason: "Auto-attribution",
    });
    expect(grantError, "Un candidat a réussi à s'auto-attribuer le badge.").not.toBeNull();

    const { error: flagError } = await candidateClient.rpc("set_test_account_flag", {
      target_user_id: candidateId,
      is_test: true,
      reason: "Auto-marquage",
    });
    expect(flagError, "Un candidat a réussi à changer son propre drapeau is_test_account.").not.toBeNull();
  });

  test("un admin peut accorder puis retirer le badge, journalisé dans security_logs", async () => {
    const { data: granted, error: grantError } = await adminClient.rpc("grant_verified_recruiter_badge", {
      target_user_id: candidateId,
      reason: "Test E2E — attribution légitime",
    });
    expect(grantError, `grant_verified_recruiter_badge a échoué pour l'admin : ${grantError?.message}`).toBeNull();
    expect(granted).toBe(true);

    const { data: afterGrant } = await adminClient.from("profiles").select("badges").eq("id", candidateId).single();
    expect(afterGrant.badges || []).toContain("verified_recruiter");

    const { data: grantLog } = await adminClient
      .from("security_logs")
      .select("event_type, severity, target_user_id")
      .eq("target_user_id", candidateId)
      .eq("event_type", "badge_granted_direct")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(grantLog, "Aucune entrée security_logs pour l'attribution directe du badge.").not.toBeNull();

    const { data: revoked, error: revokeError } = await adminClient.rpc("revoke_badge", {
      target_user_id: candidateId,
      badge_name: "verified_recruiter",
      reason: "Test E2E — retrait",
    });
    expect(revokeError).toBeNull();
    expect(revoked).toBe(true);

    const { data: afterRevoke } = await adminClient.from("profiles").select("badges").eq("id", candidateId).single();
    expect(afterRevoke.badges || []).not.toContain("verified_recruiter");
  });

  test("un admin peut basculer is_test_account, journalisé dans security_logs", async () => {
    const { data: setTrue, error: setTrueError } = await adminClient.rpc("set_test_account_flag", {
      target_user_id: candidateId,
      is_test: true,
      reason: "Test E2E — bascule",
    });
    expect(setTrueError).toBeNull();
    expect(setTrue).toBe(true);

    const { data: afterSet } = await adminClient.from("profiles").select("is_test_account").eq("id", candidateId).single();
    expect(afterSet.is_test_account).toBe(true);

    const { data: flagLog } = await adminClient
      .from("security_logs")
      .select("event_type, details")
      .eq("target_user_id", candidateId)
      .eq("event_type", "test_account_flag_changed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(flagLog, "Aucune entrée security_logs pour la bascule is_test_account.").not.toBeNull();
    expect(flagLog.details?.is_test_account).toBe(true);
  });
});
