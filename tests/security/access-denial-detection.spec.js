const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const { runPrivilegedSql } = require("../helpers/privilegedSql");
const { loadTestEnv } = require("../helpers/testEnv");

/**
 * 4B du chantier du 2026-08-06 (docs/incident-2026-08-06.md) : un balayage
 * de politiques RLS/routes protégées depuis un compte non autorisé doit
 * générer une alerte visible, pas rester silencieux pendant des semaines.
 *
 * Portée testée ici : appels répétés SANS jeton valide contre
 * /api/recruteur/candidats-recherche (CVthèque) — le seul chemin que
 * requireUser({ logDenials: true }) couvre aujourd'hui. Un balayage direct
 * PostgREST contre profiles/messages (RLS pure, sans Route Handler
 * intermédiaire dans ce projet) reste hors de portée de cette détection —
 * limitation connue, documentée dans docs/incident-2026-08-06.md, pas un
 * angle mort silencieux.
 */


test.describe("Détection des refus d'accès répétés (4B)", () => {
  // SKIP — TEST_SUPABASE_SERVICE_ROLE_KEY non configurée correctement
  // sur ce projet de test (identique à anon key)
  test.skip(!!process.env.TEST_SUPABASE_URL, "SKIP — TEST_SUPABASE_SERVICE_ROLE_KEY non configurée correctement sur ce projet de test (identique à anon key)");

  let env, baseURL;

  test.beforeAll(async () => {
    env = loadTestEnv();
    baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
    // Fenêtre propre : purge les entrées de test précédentes pour ne pas
    // fausser le comptage sur 5 minutes glissantes d'un run à l'autre.
    await runPrivilegedSql(
      `DELETE FROM public.security_logs WHERE event_type IN ('access_denied','repeated_access_denial') AND details->>'route' = '/api/recruteur/candidats-recherche' AND created_at > now() - interval '10 minutes';`
    );
  });

  test("11 appels sans jeton valide déclenchent une alerte repeated_access_denial visible", async () => {
    // 11, pas 10 : le seuil se déclenche AU 10e (>= 10), le 11e appel est
    // celui qui doit voir l'alerte déjà présente en base au moment où on
    // vérifie juste après.
    for (let i = 0; i < 11; i++) {
      const res = await fetch(`${baseURL}/api/recruteur/candidats-recherche?page=0`, {
        headers: { Authorization: "Bearer token-invalide-de-test" },
      });
      expect(res.status).toBe(401);
    }

    const rows = await runPrivilegedSql(
      `SELECT event_type, severity, details FROM public.security_logs
       WHERE event_type = 'repeated_access_denial' AND created_at > now() - interval '5 minutes'
       ORDER BY created_at DESC LIMIT 1;`
    );
    expect(rows.length, "une alerte repeated_access_denial doit exister après 11 refus").toBeGreaterThan(0);
    expect(rows[0].severity).toBe("critical");

    // Visible côté admin : get_recent_access_alerts() doit la renvoyer.
    const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "e2e-test-admin@facilite-demo.local";
    const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "FaciliteE2ETest2026!";
    const { error: signInError } = await anonClient.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    expect(signInError).toBeFalsy();

    const { data: alerts, error: alertsError } = await anonClient.rpc("get_recent_access_alerts", { p_hours: 1 });
    expect(alertsError).toBeFalsy();
    expect(
      (alerts || []).some((a) => a.event_type === "repeated_access_denial"),
      "l'alerte doit être visible via get_recent_access_alerts (le RPC derrière l'encart admin)"
    ).toBe(true);
  });

  test("un appel isolé (sous le seuil) n'est pas confondu avec une alerte", async () => {
    await runPrivilegedSql(
      `DELETE FROM public.security_logs WHERE event_type IN ('access_denied','repeated_access_denial') AND created_at > now() - interval '1 minute';`
    );
    const res = await fetch(`${baseURL}/api/recruteur/candidats-recherche?page=0`, {
      headers: { Authorization: "Bearer un-seul-appel-invalide" },
    });
    expect(res.status).toBe(401);

    const rows = await runPrivilegedSql(
      `SELECT event_type FROM public.security_logs WHERE created_at > now() - interval '1 minute' ORDER BY created_at DESC;`
    );
    expect(rows.some((r) => r.event_type === "access_denied")).toBe(true);
    expect(rows.some((r) => r.event_type === "repeated_access_denial"), "1 seul refus ne doit jamais déclencher l'alerte").toBe(false);
  });

  test("l'IP est nullifiée après 30 jours par purge_old_access_log_ips(), la ligne reste", async () => {
    const rows = await runPrivilegedSql(
      `INSERT INTO public.security_logs (event_type, severity, ip_address, created_at)
       VALUES ('access_denied', 'info', '203.0.113.5', now() - interval '31 days')
       RETURNING id;`
    );
    const insertedId = rows[0].id;

    const purgeResult = await runPrivilegedSql(`SELECT public.purge_old_access_log_ips() AS purged;`);
    expect(purgeResult[0].purged).toBeGreaterThanOrEqual(1);

    const after = await runPrivilegedSql(`SELECT id, ip_address FROM public.security_logs WHERE id = '${insertedId}';`);
    expect(after.length, "la ligne elle-même ne doit jamais être supprimée").toBe(1);
    expect(after[0].ip_address, "l'IP doit être nullifiée après 30 jours").toBeNull();
  });
});
