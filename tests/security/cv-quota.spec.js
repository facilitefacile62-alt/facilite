const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const { runPrivilegedSql } = require("../helpers/privilegedSql");
const { loadTestEnv } = require("../helpers/testEnv");

/**
 * Quota quotidien de consultations de profil candidat (Point 1 du chantier
 * du 2026-08-06, suite à l'incident profiles/resumes — voir
 * docs/incident-2026-08-06.md et 20260806150000_cv_consultations_quota.sql).
 *
 * La base réelle ne compte que 11 comptes candidats — trop peu pour prouver
 * le seuil de 100 avec des profils déjà existants. Ce test crée jusqu'à 101
 * comptes candidats jetables via l'API admin (SUPABASE_SERVICE_ROLE_KEY) pour
 * pouvoir affirmer honnêtement que le 101e est bloqué, pas seulement le
 * mécanisme en général. Si cette clé est absente (comme en local avant
 * aujourd'hui, voir account-suspension.spec.js), les tests de seuil exact
 * sont ignorés explicitement plutôt que simulés — seuls les tests ne
 * nécessitant pas de créer des comptes (rejet anon, contournement admin)
 * tournent alors.
 */


const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "e2e-test-admin@facilite-demo.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "FaciliteE2ETest2026!";
const DAILY_LIMIT = 100;
const FIXTURE_COUNT = DAILY_LIMIT + 1;
const CHUNK_SIZE = 20;

test.describe("Quota quotidien de consultations CV (record_cv_consultations)", () => {
  let env;
  let recruiterClient, recruiterId, recruiterAccessToken;
  let anonClient;
  let adminAuthClient; // service_role, seulement si dispo
  let fixtureCandidateIds = [];
  let hasServiceRole = false;

  test.beforeAll(async () => {
    env = loadTestEnv();
    anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    recruiterClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    // Compte recruteur jetable auto-provisionné plutôt qu'un compte e2e-test-*
    // partagé : découvert en construisant ce test, e2e-test-candidate porte
    // en réalité role='admin' dans user_roles en base réelle aujourd'hui —
    // ce qui aurait fait passer ce test pour une mauvaise raison (branche de
    // contournement admin de record_cv_consultations) au lieu de tester le
    // quota réel. Signalé séparément, pas corrigé ici — hors du périmètre
    // de ce test. Un signUp() frais garantit role='user' par défaut.
    const throwawayEmail = `quota-recruiter-${Date.now()}@facilite-demo.local`;
    const throwawayPassword = "FaciliteQuotaFixture2026!";
    const { data: signUpData, error: signUpError } = await recruiterClient.auth.signUp({
      email: throwawayEmail,
      password: throwawayPassword,
      options: { data: { full_name: "Quota Test Recruiter" } },
    });
    if (signUpError) throw new Error(`Création du recruteur de test échouée : ${signUpError.message}`);
    recruiterId = signUpData.user.id;
    recruiterAccessToken = signUpData.session?.access_token;
    if (!recruiterAccessToken) {
      // Confirmation email requise selon la config — confirme directement en
      // base (contexte de test uniquement) puis se connecte normalement.
      await runPrivilegedSql(`UPDATE auth.users SET email_confirmed_at = now() WHERE id = '${recruiterId}';`);
      const { data: signInData, error: signInError } = await recruiterClient.auth.signInWithPassword({
        email: throwawayEmail,
        password: throwawayPassword,
      });
      if (signInError) throw new Error(`Connexion du recruteur de test échouée : ${signInError.message}`);
      recruiterAccessToken = signInData.session.access_token;
    }

    await runPrivilegedSql(
      `UPDATE public.profiles SET is_test_account = true, badges = CASE WHEN badges @> '["verified_recruiter"]'::jsonb THEN badges ELSE badges || '["verified_recruiter"]'::jsonb END WHERE id = '${recruiterId}';`
    );

    hasServiceRole = !!env.SUPABASE_SERVICE_ROLE_KEY;
    if (hasServiceRole) {
      adminAuthClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const created = [];
      for (let i = 0; i < FIXTURE_COUNT; i += CHUNK_SIZE) {
        const batch = Array.from({ length: Math.min(CHUNK_SIZE, FIXTURE_COUNT - i) }, (_, j) => i + j);
        const results = await Promise.all(
          batch.map((n) =>
            adminAuthClient.auth.admin.createUser({
              email: `quota-fixture-${Date.now()}-${n}@facilite-demo.local`,
              password: "FaciliteQuotaFixture2026!",
              email_confirm: true,
              user_metadata: { full_name: `Quota Fixture ${n}` },
            })
          )
        );
        for (const r of results) {
          if (r.error) throw new Error(`Création fixture échouée : ${r.error.message}`);
          created.push(r.data.user.id);
        }
      }
      fixtureCandidateIds = created;

      // Marque explicitement ces comptes comme comptes de test (invariant de
      // test-account-isolation, même si ce test n'y touche pas directement).
      await runPrivilegedSql(
        `UPDATE public.profiles SET is_test_account = true WHERE id = ANY(ARRAY[${fixtureCandidateIds.map((id) => `'${id}'`).join(",")}]::uuid[]);`
      );
    }
  });

  test.afterAll(async () => {
    if (hasServiceRole && recruiterId) {
      await adminAuthClient.auth.admin.deleteUser(recruiterId).catch((e) => console.error("Nettoyage échoué (non bloquant) :", e.message));
    } else {
      await runPrivilegedSql(
        `UPDATE public.profiles SET badges = badges - 'verified_recruiter' WHERE id = '${recruiterId}';`
      ).catch((e) => console.error("Nettoyage échoué (non bloquant) :", e.message));
    }

    if (hasServiceRole && fixtureCandidateIds.length > 0) {
      for (let i = 0; i < fixtureCandidateIds.length; i += CHUNK_SIZE) {
        const batch = fixtureCandidateIds.slice(i, i + CHUNK_SIZE);
        await Promise.all(
          batch.map((id) => adminAuthClient.auth.admin.deleteUser(id).catch((e) => console.error("Nettoyage échoué (non bloquant) :", e.message)))
        );
      }
    }
  });

  test("un appel direct à l'API avec la clé anon ne peut ni consulter ni lire le quota", async () => {
    const { error: recordError } = await anonClient.rpc("record_cv_consultations", {
      p_candidate_ids: [recruiterId],
    });
    expect(recordError, "record_cv_consultations doit refuser un appel anonyme").toBeTruthy();

    const { error: readError } = await anonClient.rpc("get_cv_quota_today");
    expect(readError, "get_cv_quota_today doit refuser un appel anonyme").toBeTruthy();
  });

  test("consulter deux fois le même candidat le même jour ne consomme le quota qu'une fois", async () => {
    const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${recruiterAccessToken}` } },
    });
    const targetId = fixtureCandidateIds[0] || recruiterId;

    const first = await client.rpc("record_cv_consultations", { p_candidate_ids: [targetId] });
    expect(first.error).toBeFalsy();
    expect(first.data?.[0]?.allowed).toBe(true);

    const second = await client.rpc("record_cv_consultations", { p_candidate_ids: [targetId] });
    expect(second.error).toBeFalsy();
    expect(second.data?.[0]?.allowed).toBe(true);

    const { data: quota } = await client.rpc("get_cv_quota_today").single();
    expect(quota.used_count, "revoir le même candidat ne doit pas incrémenter deux fois").toBe(1);
  });

  test("le 101e candidat distinct de la journée est bloqué, exactement au seuil de 100", async () => {
    test.skip(!hasServiceRole, "SUPABASE_SERVICE_ROLE_KEY absent de cet environnement — impossible de créer les 101 comptes fixture nécessaires pour prouver le seuil exact, voir l'en-tête de ce fichier.");

    const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${recruiterAccessToken}` } },
    });

    // Repart propre : le test précédent a déjà consommé 1 slot sur le même
    // candidat récurrent — on le réutilise ici pour ne pas fausser le compte
    // (déjà vu = gratuit), puis on ajoute exactement les 100 restants.
    const remainingNeeded = DAILY_LIMIT - 1;
    const idsForThisTest = [fixtureCandidateIds[0], ...fixtureCandidateIds.slice(1, 1 + remainingNeeded)];
    const { data: withinQuota, error: err1 } = await client.rpc("record_cv_consultations", {
      p_candidate_ids: idsForThisTest,
    });
    expect(err1).toBeFalsy();
    expect(withinQuota.every((r) => r.allowed), "les 100 premiers candidats distincts du jour doivent tous être autorisés").toBe(true);

    const { data: quotaAtLimit } = await client.rpc("get_cv_quota_today").single();
    expect(quotaAtLimit.used_count).toBe(DAILY_LIMIT);
    expect(quotaAtLimit.remaining).toBe(0);

    const overLimitId = fixtureCandidateIds[FIXTURE_COUNT - 1];
    const { data: overQuota, error: err2 } = await client.rpc("record_cv_consultations", {
      p_candidate_ids: [overLimitId],
    });
    expect(err2).toBeFalsy();
    expect(overQuota?.[0]?.allowed, "le candidat au-delà du seuil doit être bloqué").toBe(false);

    const { data: logs } = await client.rpc("get_cv_quota_today").single();
    expect(logs.used_count, "un candidat bloqué ne doit pas être compté").toBe(DAILY_LIMIT);
  });

  test("le dépassement du seuil est journalisé dans security_logs", async () => {
    test.skip(!hasServiceRole, "Dépend du test précédent, lui-même ignoré sans SUPABASE_SERVICE_ROLE_KEY.");

    const rows = await runPrivilegedSql(
      `SELECT event_type, severity, actor_id FROM public.security_logs
       WHERE event_type = 'cv_quota_exceeded' AND actor_id = '${recruiterId}'
       AND created_at > now() - interval '10 minutes'
       ORDER BY created_at DESC LIMIT 1;`
    );
    expect(rows.length, "une entrée cv_quota_exceeded doit exister pour ce recruteur").toBeGreaterThan(0);
    expect(rows[0].severity).toBe("warning");
  });

  test("un compte admin n'est jamais soumis au quota", async () => {
    const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data: adminSignIn, error: adminSignInError } = await adminClient.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    expect(adminSignInError).toBeFalsy();

    const probeIds = fixtureCandidateIds.length > 0 ? fixtureCandidateIds.slice(0, 5) : [recruiterId];
    const { data, error } = await adminClient.rpc("record_cv_consultations", { p_candidate_ids: probeIds });
    expect(error).toBeFalsy();
    expect(data.every((r) => r.allowed), "un admin doit toujours être autorisé, quel que soit le volume").toBe(true);

    const { data: adminQuota } = await adminClient.rpc("get_cv_quota_today").single();
    expect(adminQuota.used_count, "un admin ne doit jamais accumuler de consultations comptabilisées").toBe(0);
  });
});
