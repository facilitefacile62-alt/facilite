const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

/**
 * Protection de la phase de test (2026-08-02) : un compte badgé
 * verified_recruiter pour simulation ne doit JAMAIS recevoir de profil
 * candidat réel, quelles que soient ses autres permissions — is_test_account
 * isole bidirectionnellement candidats_recherche/match_resumes, en plus de
 * cv_visible_recruteurs (opt-in explicite, distinct du simple dépôt de CV).
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

function runPrivilegedSql(sql) {
  const tmpFile = path.join(os.tmpdir(), `test-isolation-${Date.now()}.sql`);
  fs.writeFileSync(tmpFile, sql);
  try {
    execSync(`npx supabase db query --linked --yes -f "${tmpFile}"`, {
      cwd: path.resolve(__dirname, "../.."),
      stdio: "pipe",
    });
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

const CANDIDATE_EMAIL = process.env.E2E_CANDIDATE_EMAIL || "e2e-test-candidate@facilite-demo.local";
const CANDIDATE_PASSWORD = process.env.E2E_CANDIDATE_PASSWORD || "FaciliteE2ETest2026!";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "e2e-test-admin@facilite-demo.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "FaciliteE2ETest2026!";
const FICTIONAL_PROFILE_IDS = [
  "90000000-0000-4000-a000-000000000001",
  "90000000-0000-4000-a000-000000000002",
  "90000000-0000-4000-a000-000000000003",
];

test.describe("Protection phase de test — isolation is_test_account", () => {
  let candidateClient;
  let adminClient;
  let candidateId;
  let candidateAccessToken;
  let requestId;

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
    candidateAccessToken = candAuth.session.access_token;

    const { error: adminErr } = await adminClient.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    expect(adminErr, `Connexion admin échouée : ${adminErr?.message}`).toBeNull();
  });

  test.afterAll(async () => {
    if (candidateId) {
      runPrivilegedSql(`UPDATE public.profiles SET is_test_account = false WHERE id = '${candidateId}';`);
      await adminClient.rpc("revoke_badge", {
        target_user_id: candidateId,
        badge_name: "verified_recruiter",
        reason: "Nettoyage post-test",
      });
    }
    if (requestId) {
      await adminClient.from("badge_requests").delete().eq("id", requestId);
    }
  });

  test("les 3 profils fictifs existent, marqués is_test_account + cv_visible_recruteurs", async () => {
    const { data, error } = await adminClient
      .from("profiles")
      .select("id, is_test_account, cv_visible_recruteurs")
      .in("id", FICTIONAL_PROFILE_IDS);
    expect(error).toBeNull();
    expect(data.length).toBe(3);
    for (const row of data) {
      expect(row.is_test_account).toBe(true);
      expect(row.cv_visible_recruteurs).toBe(true);
    }
  });

  test("un recruteur vérifié RÉEL ne voit jamais les profils fictifs de test", async ({ request }) => {
    const { data: created } = await candidateClient
      .from("badge_requests")
      .insert({
        user_id: candidateId,
        requested_badge: "verified_recruiter",
        company_name: "Test Isolation SARL",
        ninea_number: "5556667778889",
        rccm_number: "SN.DKR.2026.A.55555",
      })
      .select()
      .single();
    requestId = created.id;
    const { data: approved } = await adminClient.rpc("approve_badge_request", { request_id: requestId });
    expect(approved).toBe(true);

    const response = await request.get("/api/recruteur/candidats-recherche?pageSize=1000", {
      headers: { Authorization: `Bearer ${candidateAccessToken}` },
    });
    const body = await response.json();
    const returnedIds = (body.candidates || []).map((c) => c.id);
    const leaked = FICTIONAL_PROFILE_IDS.filter((id) => returnedIds.includes(id));
    expect(leaked, "Un compte réel a reçu des profils fictifs de test.").toEqual([]);
  });

  test("un compte de test badgé verified_recruiter ne reçoit QUE des profils fictifs, jamais un profil réel", async ({ request }) => {
    // Bascule le compte candidat de test lui-même en is_test_account=true
    // (accès SQL direct — cette colonne n'est jamais grantée à
    // authenticated, cf. 20260802150000) : simule un "ami" en simulation.
    runPrivilegedSql(`UPDATE public.profiles SET is_test_account = true WHERE id = '${candidateId}';`);

    const response = await request.get("/api/recruteur/candidats-recherche?pageSize=1000", {
      headers: { Authorization: `Bearer ${candidateAccessToken}` },
    });
    expect(response.ok()).toBe(true);
    const body = await response.json();
    const returnedIds = (body.candidates || []).map((c) => c.id);

    expect(returnedIds.length, "Un compte de test n'a reçu aucun profil (même pas les fictifs).").toBeGreaterThan(0);
    for (const id of returnedIds) {
      expect(FICTIONAL_PROFILE_IDS, `Le profil ${id} n'est pas marqué is_test_account — fuite d'un profil réel.`).toContain(id);
    }
  });

  test("cv_visible_recruteurs=false exclut un profil même avec is_test_account correct", async ({ request }) => {
    runPrivilegedSql(
      `UPDATE public.profiles SET cv_visible_recruteurs = false WHERE id = '90000000-0000-4000-a000-000000000001';`
    );

    try {
      const response = await request.get("/api/recruteur/candidats-recherche?pageSize=1000", {
        headers: { Authorization: `Bearer ${candidateAccessToken}` },
      });
      const body = await response.json();
      const returnedIds = (body.candidates || []).map((c) => c.id);
      expect(
        returnedIds,
        "Un profil avec cv_visible_recruteurs=false a été renvoyé par la CVthèque."
      ).not.toContain("90000000-0000-4000-a000-000000000001");
    } finally {
      runPrivilegedSql(
        `UPDATE public.profiles SET cv_visible_recruteurs = true WHERE id = '90000000-0000-4000-a000-000000000001';`
      );
    }
  });

  test("is_test_account n'est pas modifiable par le propriétaire du profil lui-même", async () => {
    const { error } = await candidateClient.from("profiles").update({ is_test_account: true }).eq("id", candidateId);
    expect(error, "Un utilisateur a pu modifier is_test_account sur son propre profil.").not.toBeNull();
  });
});
