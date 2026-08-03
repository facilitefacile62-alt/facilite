const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

/**
 * Étape E du chantier (2026-08-03) — mode démo : le compte
 * demo.investisseur@facilite-demo.local (is_test_account=true) affiche un
 * jeu de données fictif riche (supabase/scripts/generate-demo-data.sql)
 * pour les présentations, sans jamais toucher au site public — vérifié
 * directement contre l'API avec la clé anon, pas une simulation.
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
  const tmpFile = path.join(os.tmpdir(), `demoiso-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
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

const DEMO_RECRUITER_ID = "90000000-0000-4000-a000-000000000099";
const CANDIDATE_EMAIL = process.env.E2E_CANDIDATE_EMAIL || "e2e-test-candidate@facilite-demo.local";
const CANDIDATE_PASSWORD = process.env.E2E_CANDIDATE_PASSWORD || "FaciliteE2ETest2026!";
const SECURITY_EMAIL = process.env.E2E_SECURITY_EMAIL || "e2e-test-security@facilite-demo.local";
const SECURITY_PASSWORD = process.env.E2E_SECURITY_PASSWORD || "FaciliteE2ETest2026!";
const DEMO_EMAIL = "demo.investisseur@facilite-demo.local";
const DEMO_PASSWORD = "CompteDemoNonUtilisable2026!";

test.describe("Mode démo — isolation vis-à-vis du site public", () => {
  let anonClient, candidateClient, securityClient, securityId;

  test.beforeAll(async () => {
    const env = loadEnvLocal();
    anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    candidateClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    securityClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    await candidateClient.auth.signInWithPassword({ email: CANDIDATE_EMAIL, password: CANDIDATE_PASSWORD });
    const { data: secAuth } = await securityClient.auth.signInWithPassword({ email: SECURITY_EMAIL, password: SECURITY_PASSWORD });
    securityId = secAuth.user.id;
    // Un VRAI recruteur vérifié (pas is_test_account) est le seul cas où
    // une fuite serait détectable — un compte sans badge reçoit de toute
    // façon un résultat vide, ce qui ne prouverait rien.
    runPrivilegedSql(`
      UPDATE public.profiles SET badges = badges || '["verified_recruiter"]'::jsonb
      WHERE id = '${securityId}' AND NOT (badges @> '["verified_recruiter"]'::jsonb);
    `);
  });

  test.afterAll(() => {
    runPrivilegedSql(`UPDATE public.profiles SET badges = badges - 'verified_recruiter' WHERE id = '${securityId}';`);
  });

  test("aucune offre démo n'est lisible via la lecture publique (clé anon, sans session)", async () => {
    const { data, error } = await anonClient
      .from("job_offers")
      .select("id")
      .eq("recruiter_id", DEMO_RECRUITER_ID)
      .eq("status", "approved")
      .eq("is_active", true);
    expect(error).toBeNull();
    expect(data, "Une offre de démo est visible via la lecture publique — fuite vers le site réel.").toEqual([]);
  });

  test("aucune offre démo n'est lisible par un compte authentifié réel autre que le recruteur démo", async () => {
    const { data, error } = await candidateClient
      .from("job_offers")
      .select("id")
      .eq("recruiter_id", DEMO_RECRUITER_ID);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  test("le compte démo voit bien ses propres offres et candidatures (tableau de bord fonctionnel)", async () => {
    const env = loadEnvLocal();
    const demoClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { error: authErr } = await demoClient.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    expect(authErr, `Connexion compte démo échouée : ${authErr?.message}`).toBeNull();

    const { data: offers, error: offersErr } = await demoClient.from("job_offers").select("id, status").eq("recruiter_id", DEMO_RECRUITER_ID);
    expect(offersErr).toBeNull();
    expect(offers.length).toBe(8);

    const { data: candidatures, error: candErr } = await demoClient.rpc("get_recruiter_candidatures");
    expect(candErr).toBeNull();
    expect(candidatures.length).toBeGreaterThan(0);
  });

  test("les candidats fictifs du mode démo n'apparaissent jamais dans une recherche CVthèque réelle", async () => {
    // get_candidats_recherche() exclut déjà tout is_test_account=true pour
    // un appelant qui ne l'est pas lui-même (20260802120000) — ce test
    // vérifie spécifiquement les 10 nouveaux profils du funnel démo, pas
    // seulement les 3 déjà couverts par test-account-isolation.spec.js.
    const { data, error } = await securityClient.rpc("get_candidats_recherche");
    expect(error).toBeNull();
    const demoCandidateIds = Array.from({ length: 10 }, (_, i) => `90000000-0000-4000-a000-00000000001${i}`);
    const leaked = (data || []).filter((row) => demoCandidateIds.includes(row.id));
    expect(leaked, "Des profils candidats du funnel démo ont fui vers une recherche réelle.").toEqual([]);
  });
});
