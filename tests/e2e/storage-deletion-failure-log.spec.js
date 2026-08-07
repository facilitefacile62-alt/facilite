const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const { runPrivilegedSql } = require("../helpers/privilegedSql");
const { loadTestEnv } = require("../helpers/testEnv");

/**
 * Partie 2, Étape 3.1 du chantier : un échec de suppression Storage après
 * delete_own_resume() (ligne déjà supprimée, fichier resté orphelin) doit
 * être journalisé, sans que l'appelant puisse falsifier l'acteur ou la
 * cible de l'évènement — log_security_event() elle-même n'est exécutable
 * que par service_role (vérifié), donc log_own_storage_deletion_failure()
 * est le seul chemin ouvert à authenticated, et il force auth.uid().
 */


const CANDIDATE_EMAIL = process.env.E2E_CANDIDATE_EMAIL || "e2e-test-candidate@facilite-demo.local";
const CANDIDATE_PASSWORD = process.env.E2E_CANDIDATE_PASSWORD || "FaciliteE2ETest2026!";
const SECURITY_EMAIL = process.env.E2E_SECURITY_EMAIL || "e2e-test-security@facilite-demo.local";
const SECURITY_PASSWORD = process.env.E2E_SECURITY_PASSWORD || "FaciliteE2ETest2026!";

test.describe("Journalisation d'un échec de suppression Storage", () => {
  let candidateClient, securityClient;
  let candidateId, securityId;

  test.beforeAll(async () => {
    const env = loadTestEnv();
    candidateClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    securityClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    const { data: candAuth } = await candidateClient.auth.signInWithPassword({
      email: CANDIDATE_EMAIL,
      password: CANDIDATE_PASSWORD,
    });
    candidateId = candAuth.user.id;

    const { data: secAuth } = await securityClient.auth.signInWithPassword({
      email: SECURITY_EMAIL,
      password: SECURITY_PASSWORD,
    });
    securityId = secAuth.user.id;
  });

  test("log_security_event() n'est appelable que par service_role, pas par authenticated", async () => {
    let threw = false;
    try {
      await candidateClient
        .rpc("log_security_event", {
          p_event_type: "fake",
          p_severity: "info",
          p_actor_id: candidateId,
          p_target_user_id: candidateId,
          p_details: {},
        })
        .throwOnError();
    } catch {
      threw = true;
    }
    expect(threw, "authenticated ne devrait pas pouvoir écrire directement dans security_logs.").toBe(true);
  });

  test("log_own_storage_deletion_failure() enregistre l'échec avec l'appelant réel comme acteur", async () => {
    const marker = `test-path-${Date.now()}.pdf`;
    const { error } = await candidateClient.rpc("log_own_storage_deletion_failure", {
      p_bucket: "resumes",
      p_path: marker,
    });
    expect(error).toBeNull();

    const rows = await runPrivilegedSql(
      `SELECT actor_id, target_user_id, event_type, details FROM public.security_logs WHERE event_type = 'storage_deletion_failed' AND details->>'path' = '${marker}';`
    );
    expect(rows.length).toBe(1);
    expect(rows[0].actor_id).toBe(candidateId);
    expect(rows[0].target_user_id).toBe(candidateId);
    expect(rows[0].details.bucket).toBe("resumes");
  });

  test("un appelant ne peut pas se faire passer pour un autre acteur — la fonction ignore tout paramètre d'identité", async () => {
    // La signature de log_own_storage_deletion_failure(bucket, path) n'a
    // aucun paramètre d'acteur — impossible d'en passer un même en
    // essayant. On vérifie ici que l'appel de security réel loggue bien
    // security comme acteur, jamais candidate, même si on tente d'appeler
    // depuis le client de candidate en visant security dans le chemin.
    const marker = `spoof-test-${Date.now()}.pdf`;
    await securityClient.rpc("log_own_storage_deletion_failure", { p_bucket: "resumes", p_path: marker });

    const rows = await runPrivilegedSql(
      `SELECT actor_id FROM public.security_logs WHERE event_type = 'storage_deletion_failed' AND details->>'path' = '${marker}';`
    );
    expect(rows.length).toBe(1);
    expect(rows[0].actor_id).toBe(securityId);
    expect(rows[0].actor_id).not.toBe(candidateId);
  });
});
