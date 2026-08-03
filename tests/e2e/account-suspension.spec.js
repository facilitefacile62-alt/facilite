const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const { runPrivilegedSql } = require("../helpers/privilegedSql");

/**
 * Étape 3 du chantier : une suspension de compte doit tenir au niveau
 * PostgreSQL, pas seulement empêcher une nouvelle connexion. current_user_role()
 * (20260803040000_moderation_et_suspension.sql) renvoie NULL pour un compte
 * dont user_roles.status <> 'active' — ce qui bloque IMMÉDIATEMENT toute
 * action gérée par cette fonction (la quasi-totalité des actions privilégiées
 * du schéma), même avec un token déjà émis et toujours valide.
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

const SECURITY_EMAIL = process.env.E2E_SECURITY_EMAIL || "e2e-test-security@facilite-demo.local";
const SECURITY_PASSWORD = process.env.E2E_SECURITY_PASSWORD || "FaciliteE2ETest2026!";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "e2e-test-admin@facilite-demo.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "FaciliteE2ETest2026!";
const FAKE_UUID = "00000000-0000-4000-a000-000000000000";

test.describe("Suspension de compte — verrou PostgreSQL, pas seulement l'écran de connexion", () => {
  let securityClient, adminClient;
  let securityId, adminId;

  test.beforeAll(async () => {
    const env = loadEnvLocal();
    securityClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data } = await securityClient.auth.signInWithPassword({
      email: SECURITY_EMAIL,
      password: SECURITY_PASSWORD,
    });
    securityId = data.user.id;
    const { data: adminData } = await adminClient.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    adminId = adminData.user.id;
  });

  test.afterAll(async () => {
    // Chaque étape est indépendante (.catch plutôt que laisser un échec
    // interrompre les suivantes) : un flake CLI ponctuel sur la première ne
    // doit jamais laisser le compte admin suspendu pour les runs suivants —
    // exactement le bug de contamination trouvé le 2026-08-03 (voir
    // docs/diagnostic-tests-bloquants.md).
    await runPrivilegedSql(`UPDATE public.user_roles SET status = 'active' WHERE user_id = '${securityId}';`).catch((e) =>
      console.error("Nettoyage échoué (non bloquant) :", e.message)
    );
    await runPrivilegedSql(`UPDATE public.user_roles SET status = 'active' WHERE user_id = '${adminId}';`).catch((e) =>
      console.error("Nettoyage échoué (non bloquant) :", e.message)
    );
  });

  test("current_user_role() renvoie NULL pour un compte suspendu, avec le MÊME token déjà émis", async () => {
    // Vérifie d'abord que le token en cours donne un rôle réel (compte actif).
    const { data: beforeRole } = await securityClient.rpc("current_user_role");
    expect(beforeRole).toBe("user");

    await runPrivilegedSql(`UPDATE public.user_roles SET status = 'suspended' WHERE user_id = '${securityId}';`);

    // Même client, même token — aucune reconnexion. C'est la preuve que le
    // verrou est réévalué en base à chaque appel, pas mis en cache dans le JWT.
    const { data: afterRole } = await securityClient.rpc("current_user_role");
    expect(afterRole, "current_user_role() doit renvoyer NULL pour un compte suspendu.").toBeNull();
  });

  test("un token de compte suspendu ne peut plus déclencher d'action réservée à un rôle", async () => {
    await runPrivilegedSql(`UPDATE public.user_roles SET status = 'suspended' WHERE user_id = '${securityId}';`);

    // approve_badge_request() exige current_user_role() = 'admin' — même si
    // ce compte avait un rôle privilégié avant suspension, l'appel échoue.
    let threw = false;
    try {
      await securityClient.rpc("approve_badge_request", { request_id: "00000000-0000-4000-a000-000000000000" }).throwOnError();
    } catch {
      threw = true;
    }
    expect(threw, "Un compte suspendu ne devrait déclencher aucune action réservée aux rôles privilégiés.").toBe(true);
  });

  test("un ADMIN suspendu ne passe plus AUCUNE des 4 gardes admin (approve/reject_badge_request, revoke_badge, moderate_job_offer)", async () => {
    // Reproduit fidèlement le bug corrigé par 20260803050000 : un compte qui
    // a réellement le rôle 'admin' (pas seulement 'user'), suspendu après
    // coup — c'est précisément le cas où NULL <> 'admin' (au lieu de IS
    // DISTINCT FROM) laissait passer silencieusement les 4 fonctions.
    const { data: roleBefore } = await adminClient.rpc("current_user_role");
    expect(roleBefore, "Sanity check : ce compte doit réellement être admin avant suspension.").toBe("admin");

    await runPrivilegedSql(`UPDATE public.user_roles SET status = 'suspended' WHERE user_id = '${adminId}';`);

    const { data: roleAfter } = await adminClient.rpc("current_user_role");
    expect(roleAfter).toBeNull();

    const calls = [
      ["approve_badge_request", { request_id: FAKE_UUID }],
      ["reject_badge_request", { request_id: FAKE_UUID, reason: "test" }],
      ["revoke_badge", { target_user_id: FAKE_UUID, badge_name: "verified_recruiter", reason: "test" }],
      ["moderate_job_offer", { offer_id: FAKE_UUID, decision: "approved", reason: "test" }],
    ];

    for (const [fn, args] of calls) {
      let threw = false;
      try {
        await adminClient.rpc(fn, args).throwOnError();
      } catch {
        threw = true;
      }
      expect(threw, `${fn}() ne doit plus être exécutable par un admin suspendu.`).toBe(true);
    }

    await runPrivilegedSql(`UPDATE public.user_roles SET status = 'active' WHERE user_id = '${adminId}';`);
    const { data: roleRestored } = await adminClient.rpc("current_user_role");
    expect(roleRestored).toBe("admin");
  });

  test("la réactivation restaure immédiatement le rôle sans nouvelle connexion", async () => {
    await runPrivilegedSql(`UPDATE public.user_roles SET status = 'active' WHERE user_id = '${securityId}';`);

    const { data: restoredRole } = await securityClient.rpc("current_user_role");
    expect(restoredRole).toBe("user");
  });

  // Pas de test E2E pour isCallerAdmin() (lib/rbac.js) contre les routes
  // /api/admin/users/[id]/{role,status} : ces routes exigent
  // SUPABASE_SERVICE_ROLE_KEY, présent sur Vercel mais absent localement
  // (limitation connue, déjà documentée pour d'autres routes admin cette
  // session) — tentative faite, échec en 500 (config manquante) et non en
  // 403, donc aucun signal exploitable localement. Le correctif lui-même
  // (isCallerAdmin vérifie désormais status === 'active' en plus de
  // role === 'admin', src/lib/rbac.js) suit exactement le même raisonnement
  // que les 4 fonctions SQL ci-dessus, prouvées par les tests précédents.
});
