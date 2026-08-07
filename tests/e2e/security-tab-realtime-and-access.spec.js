const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const { runPrivilegedSql } = require("../helpers/privilegedSql");
const { loadTestEnv } = require("../helpers/testEnv");

/**
 * Partie D du chantier admin (2026-08-07) — onglet Sécurité :
 * - accès réservé aux admins, vérifié au niveau RLS/fonction, pas
 *   seulement en masquant le lien.
 * - Temps réel (Realtime sur security_logs) : seuls les admins reçoivent
 *   les événements, un publisher abonné au même canal ne reçoit rien.
 *
 * Nuance importante sur "reçoit une erreur d'autorisation" (demande du
 * client) : une lecture directe .from("security_logs") sous RLS ne
 * renvoie PAS une erreur PostgREST pour un rôle non admin — RLS filtre
 * silencieusement les lignes (comportement standard Postgres/PostgREST
 * pour SELECT, différent d'un GRANT manquant). Le vrai résultat vérifiable
 * est "zéro ligne", testé ci-dessous. Les RPC dédiées à l'onglet Sécurité
 * (get_security_alert_history, resolve_security_alert), elles, RAISE
 * EXCEPTION explicitement pour un non-admin — c'est ce qui produit une
 * vraie erreur d'autorisation, testé aussi.
 */


const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "e2e-test-admin@facilite-demo.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "FaciliteE2ETest2026!";
const PUBLISHER_EMAIL = process.env.E2E_PUBLISHER_EMAIL || "e2e-test-agent@facilite-demo.local";
const PUBLISHER_PASSWORD = process.env.E2E_PUBLISHER_PASSWORD || "FaciliteE2ETest2026!";

test.describe("Onglet Sécurité admin — accès et temps réel", () => {
  let env;
  let adminClient;
  let publisherClient;

  test.beforeAll(async () => {
    env = loadTestEnv();
    adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    publisherClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    const { error: adminErr } = await adminClient.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    expect(adminErr, `Connexion admin échouée : ${adminErr?.message}`).toBeNull();

    const { data: pubAuth, error: pubErr } = await publisherClient.auth.signInWithPassword({
      email: PUBLISHER_EMAIL,
      password: PUBLISHER_PASSWORD,
    });
    expect(pubErr, `Connexion publisher échouée : ${pubErr?.message}`).toBeNull();

    const { data: pubRole } = await adminClient.from("user_roles").select("role").eq("user_id", pubAuth.user.id).single();
    expect(pubRole?.role, "Le compte de test publisher n'a pas role='publisher'.").toBe("publisher");
  });

  test("un publisher qui lit security_logs directement ne voit aucune ligne (RLS)", async () => {
    const { data, error } = await publisherClient.from("security_logs").select("*").limit(10);
    expect(error, `Lecture directe security_logs a échoué en erreur inattendue : ${error?.message}`).toBeNull();
    expect(data, "Un publisher a pu lire des lignes de security_logs malgré RLS.").toEqual([]);
  });

  test("un publisher qui appelle get_security_alert_history reçoit une erreur d'autorisation", async () => {
    const { data, error } = await publisherClient.rpc("get_security_alert_history", { p_days: 30 });
    expect(error, "Un publisher a réussi à appeler get_security_alert_history().").not.toBeNull();
    expect(data == null).toBe(true);
  });

  test("un publisher qui appelle resolve_security_alert reçoit une erreur d'autorisation", async () => {
    const { data, error } = await publisherClient.rpc("resolve_security_alert", {
      p_log_id: "00000000-0000-0000-0000-000000000000",
      p_action: "resolved",
    });
    expect(error, "Un publisher a réussi à appeler resolve_security_alert().").not.toBeNull();
    expect(data == null || data === false).toBe(true);
  });

  test("un admin lit bien security_logs et invariant_status (accès positif, pas juste l'absence de blocage)", async () => {
    const { data: logs, error: logsError } = await adminClient.from("security_logs").select("id").limit(1);
    expect(logsError).toBeNull();
    expect(Array.isArray(logs)).toBe(true);

    const { data: invariants, error: invError } = await adminClient.from("invariant_status").select("invariant_key").limit(1);
    expect(invError).toBeNull();
    expect(Array.isArray(invariants)).toBe(true);
  });

  test("un publisher ne lit aucune ligne de invariant_status", async () => {
    const { data, error } = await publisherClient.from("invariant_status").select("*").limit(10);
    expect(error).toBeNull();
    expect(data, "Un publisher a pu lire invariant_status malgré RLS.").toEqual([]);
  });

  test("Realtime — un admin reçoit un INSERT sur security_logs, un publisher abonné au même canal ne reçoit rien", async () => {
    test.setTimeout(30_000);

    let adminReceived = null;
    let publisherReceived = null;

    const adminChannel = adminClient
      .channel("test-admin-security-logs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "security_logs" }, (payload) => {
        adminReceived = payload.new;
      })
      .subscribe();

    const publisherChannel = publisherClient
      .channel("test-publisher-security-logs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "security_logs" }, (payload) => {
        publisherReceived = payload.new;
      })
      .subscribe();

    // Laisse le temps aux deux canaux de passer à l'état "SUBSCRIBED" avant
    // de déclencher l'insertion — sinon l'événement peut arriver avant que
    // l'abonnement soit effectif côté serveur Realtime.
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const probeDetails = `test-realtime-${Date.now()}`;
    await runPrivilegedSql(
      `INSERT INTO public.security_logs (event_type, severity, details)
       VALUES ('access_denied', 'info', '{"route":"${probeDetails}"}'::jsonb);`
    );

    // Fenêtre d'attente pour la propagation Realtime (typiquement <1s, on
    // laisse large pour ne pas produire un faux échec sous charge CI).
    await new Promise((resolve) => setTimeout(resolve, 8000));

    await adminClient.removeChannel(adminChannel);
    await publisherClient.removeChannel(publisherChannel);

    expect(adminReceived, "L'admin n'a reçu aucun événement Realtime pour l'INSERT.").not.toBeNull();
    expect(adminReceived?.details?.route).toBe(probeDetails);
    expect(publisherReceived, "Un publisher a reçu un événement Realtime sur security_logs malgré RLS.").toBeNull();

    await runPrivilegedSql(`DELETE FROM public.security_logs WHERE details->>'route' = '${probeDetails}';`);
  });
});
