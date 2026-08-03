const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

/**
 * Étape A du chantier (2026-08-03) : les policies Storage "Recruteurs et
 * admins lisent les CV" et "Un recruteur televerse ses visuels d'offres"
 * référençaient encore le littéral 'recruteur', un rôle qui n'existe plus
 * depuis 20260802050000_rbac_user_roles.sql — un recruteur vérifié réel ne
 * pouvait donc plus ni lire un CV, ni téléverser un visuel d'offre en
 * production. Corrigé par 20260803090000_fix_storage_role_literals.sql
 * (admin OU (user + badge verified_recruiter), même motif que
 * get_candidats_recherche). Ce test prouve la restauration ET vérifie
 * qu'elle ne s'est pas transformée en policy trop permissive.
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
  const tmpFile = path.join(os.tmpdir(), `storagerole-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  fs.writeFileSync(tmpFile, sql);
  try {
    execSync(`npx supabase db query --linked --yes -f "${tmpFile}"`, {
      cwd: path.resolve(__dirname, "../.."),
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

const CANDIDATE_EMAIL = process.env.E2E_CANDIDATE_EMAIL || "e2e-test-candidate@facilite-demo.local";
const CANDIDATE_PASSWORD = process.env.E2E_CANDIDATE_PASSWORD || "FaciliteE2ETest2026!";
const SECURITY_EMAIL = process.env.E2E_SECURITY_EMAIL || "e2e-test-security@facilite-demo.local";
const SECURITY_PASSWORD = process.env.E2E_SECURITY_PASSWORD || "FaciliteE2ETest2026!";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "e2e-test-admin@facilite-demo.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "FaciliteE2ETest2026!";

test.describe("Correctif littéraux de rôle obsolètes — Storage CV et visuels d'offre", () => {
  let candidateClient, recruiterClient, adminClient;
  let candidateId, recruiterId;
  let cvPath, badgeRequestId;

  test.beforeAll(async () => {
    const env = loadEnvLocal();
    candidateClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    recruiterClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    const { data: candAuth } = await candidateClient.auth.signInWithPassword({ email: CANDIDATE_EMAIL, password: CANDIDATE_PASSWORD });
    candidateId = candAuth.user.id;
    const { data: recAuth } = await recruiterClient.auth.signInWithPassword({ email: SECURITY_EMAIL, password: SECURITY_PASSWORD });
    recruiterId = recAuth.user.id;
    await adminClient.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    cvPath = `${candidateId}/storage-role-fix-${Date.now()}.pdf`;
    const { error: uploadErr } = await candidateClient.storage
      .from("resumes")
      .upload(cvPath, new Blob(["%PDF-1.4 test"], { type: "application/pdf" }));
    expect(uploadErr, `Upload CV échoué : ${uploadErr?.message}`).toBeNull();
  });

  test.afterAll(async () => {
    if (cvPath) await candidateClient.storage.from("resumes").remove([cvPath]);
    if (badgeRequestId) {
      await adminClient.rpc("revoke_badge", {
        target_user_id: recruiterId,
        badge_name: "verified_recruiter",
        reason: "Nettoyage post-test",
      });
    }
  });

  test("avant badge : un simple compte 'user' ne peut ni lire un CV, ni téléverser un visuel d'offre", async () => {
    const { data: dl, error: dlErr } = await recruiterClient.storage.from("resumes").download(cvPath);
    expect(dl, "Sans badge, la lecture d'un CV doit être refusée.").toBeFalsy();
    expect(dlErr).toBeTruthy();

    const { error: upErr } = await recruiterClient.storage
      .from("job-offers")
      .upload(`${recruiterId}/storage-role-fix-visual-${Date.now()}.png`, new Blob(["x"], { type: "image/png" }));
    expect(upErr, "Sans badge, le téléversement d'un visuel d'offre doit être refusé.").toBeTruthy();
  });

  test("après badge verified_recruiter : lecture CV et téléversement visuel fonctionnent de nouveau", async () => {
    const { data: created, error: reqErr } = await recruiterClient
      .from("badge_requests")
      .insert({
        user_id: recruiterId,
        requested_badge: "verified_recruiter",
        company_name: "Storage Fix Test SARL",
        ninea_number: "1112223334445",
        rccm_number: "SN.DKR.2026.A.11111",
      })
      .select()
      .single();
    expect(reqErr, `Demande de badge échouée : ${reqErr?.message}`).toBeNull();
    badgeRequestId = created.id;

    const { data: approved, error: approveErr } = await adminClient.rpc("approve_badge_request", { request_id: badgeRequestId });
    expect(approveErr).toBeNull();
    expect(approved).toBe(true);

    const { data: dl, error: dlErr } = await recruiterClient.storage.from("resumes").download(cvPath);
    expect(dlErr, `Lecture CV échouée après badge : ${dlErr?.message}`).toBeNull();
    expect(dl).toBeTruthy();

    const visualPath = `${recruiterId}/storage-role-fix-visual-${Date.now()}.png`;
    const { error: upErr } = await recruiterClient.storage
      .from("job-offers")
      .upload(visualPath, new Blob(["x"], { type: "image/png" }));
    expect(upErr, `Upload visuel échoué après badge : ${upErr?.message}`).toBeNull();
    await recruiterClient.storage.from("job-offers").remove([visualPath]);
  });

  test("un admin peut toujours lire un CV, sans badge", async () => {
    const { data: dl, error: dlErr } = await adminClient.storage.from("resumes").download(cvPath);
    expect(dlErr).toBeNull();
    expect(dl).toBeTruthy();
  });
});
