const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

/**
 * Étape F du chantier (2026-08-03) — get_recruiter_overview_stats(),
 * get_recruiter_daily_candidatures(), get_recruiter_funnel()
 * (20260803140000_recruiter_dashboard_kpi_funnel.sql) : vérifiées par appel
 * RPC direct avec la clé anon, pas seulement observées dans l'UI —
 * gate badge, isolation entre recruteurs, agrégats corrects.
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
  const tmpFile = path.join(os.tmpdir(), `kpirpc-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  fs.writeFileSync(tmpFile, sql);
  try {
    const output = execSync(`npx supabase db query --linked --yes -f "${tmpFile}"`, {
      cwd: path.resolve(__dirname, "../.."),
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return JSON.parse(output.slice(output.indexOf("{"))).rows || [];
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

const SECURITY_EMAIL = process.env.E2E_SECURITY_EMAIL || "e2e-test-security@facilite-demo.local";
const SECURITY_PASSWORD = process.env.E2E_SECURITY_PASSWORD || "FaciliteE2ETest2026!";
const DEMO_RECRUITER_ID = "90000000-0000-4000-a000-000000000099";

test.describe("KPI recruteur — get_recruiter_overview_stats / daily_candidatures / funnel", () => {
  let securityClient, securityId;

  test.beforeAll(async () => {
    const env = loadEnvLocal();
    securityClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data } = await securityClient.auth.signInWithPassword({ email: SECURITY_EMAIL, password: SECURITY_PASSWORD });
    securityId = data.user.id;
  });

  test.afterAll(() => {
    runPrivilegedSql(`UPDATE public.profiles SET badges = badges - 'verified_recruiter' WHERE id = '${securityId}';`);
  });

  test("sans badge : les 3 fonctions renvoient un résultat vide/neutre, jamais une erreur ni une fuite", async () => {
    const { data: stats, error: statsErr } = await securityClient.rpc("get_recruiter_overview_stats").single();
    expect(statsErr).toBeNull();
    expect(stats.active_offers_count).toBe(0);

    const { data: series, error: seriesErr } = await securityClient.rpc("get_recruiter_daily_candidatures", { p_days: 7 });
    expect(seriesErr).toBeNull();
    expect(series.every((d) => d.count === 0)).toBe(true);

    const { data: funnel, error: funnelErr } = await securityClient.rpc("get_recruiter_funnel");
    expect(funnelErr).toBeNull();
    expect(funnel).toEqual([]);
  });

  test("après badge, sans offre : active_offers_count=0, pas les offres d'un autre recruteur (isolation)", async () => {
    runPrivilegedSql(`
      UPDATE public.profiles SET badges = badges || '["verified_recruiter"]'::jsonb
      WHERE id = '${securityId}' AND NOT (badges @> '["verified_recruiter"]'::jsonb);
    `);

    const { data: stats, error: statsErr } = await securityClient.rpc("get_recruiter_overview_stats").single();
    expect(statsErr).toBeNull();
    expect(stats.active_offers_count, "Ce compte n'a publié aucune offre — ne doit jamais voir les 5 offres du compte démo.").toBe(0);
    expect(stats.total_views).toBe(0);

    const { data: funnel } = await securityClient.rpc("get_recruiter_funnel");
    const leaked = (funnel || []).filter((f) => f.job_offer_id && DEMO_RECRUITER_ID);
    expect(funnel, "Aucune offre du compte démo ne doit apparaître dans l'entonnoir d'un autre recruteur.").toEqual([]);
  });

  test("le nombre de jours demandé au-delà de 90 est plafonné, jamais une série illimitée", async () => {
    const { data, error } = await securityClient.rpc("get_recruiter_daily_candidatures", { p_days: 10000 });
    expect(error).toBeNull();
    expect(data.length).toBeLessThanOrEqual(90);
  });
});
