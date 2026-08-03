const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const { runPrivilegedSql } = require("../helpers/privilegedSql");

/**
 * Partie 2, Étape 4.3 du chantier : cv_visible_recruteurs est le
 * consentement explicite du candidat à apparaître dans la CVthèque
 * recruteur (FALSE par défaut, aucun backfill — déposer un CV n'est pas un
 * consentement à être présenté, voir docs/purge-avant-lancement.md).
 * Ce fichier prouve qu'un candidat ne peut modifier QUE sa propre valeur,
 * directement contre l'API réelle (clé anon + JWT), pas juste via l'UI.
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
const SECURITY_EMAIL = process.env.E2E_SECURITY_EMAIL || "e2e-test-security@facilite-demo.local";
const SECURITY_PASSWORD = process.env.E2E_SECURITY_PASSWORD || "FaciliteE2ETest2026!";

test.describe("Consentement cv_visible_recruteurs — un candidat ne modifie que sa propre valeur", () => {
  let candidateClient, securityClient;
  let candidateId, securityId;

  test.beforeAll(async () => {
    const env = loadEnvLocal();
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

  test.afterAll(async () => {
    await runPrivilegedSql(
      `UPDATE public.profiles SET cv_visible_recruteurs = false WHERE id IN ('${candidateId}', '${securityId}');`
    );
  });

  test("un candidat peut activer/désactiver SA propre visibilité", async () => {
    const { error: onErr } = await candidateClient
      .from("profiles")
      .update({ cv_visible_recruteurs: true })
      .eq("id", candidateId);
    expect(onErr).toBeNull();

    const { data: after } = await candidateClient
      .from("profiles")
      .select("cv_visible_recruteurs")
      .eq("id", candidateId)
      .single();
    expect(after.cv_visible_recruteurs).toBe(true);

    const { error: offErr } = await candidateClient
      .from("profiles")
      .update({ cv_visible_recruteurs: false })
      .eq("id", candidateId);
    expect(offErr).toBeNull();
  });

  test("un candidat ne peut PAS modifier la valeur d'un autre profil, même en ciblant son id explicitement", async () => {
    // Valeur de référence connue avant tentative.
    await runPrivilegedSql(`UPDATE public.profiles SET cv_visible_recruteurs = false WHERE id = '${securityId}';`);

    const { error, count } = await candidateClient
      .from("profiles")
      .update({ cv_visible_recruteurs: true }, { count: "exact" })
      .eq("id", securityId);

    // La RLS filtre la ligne cible (auth.uid() = id) : soit une erreur
    // explicite, soit un UPDATE qui ne touche silencieusement aucune ligne
    // — dans les deux cas, la valeur de security ne doit jamais bouger.
    if (!error) {
      expect(count, "L'UPDATE ne devrait affecter aucune ligne — ce n'est pas la ligne de l'appelant.").toBe(0);
    }

    const { data: securityRow } = await securityClient
      .from("profiles")
      .select("cv_visible_recruteurs")
      .eq("id", securityId)
      .single();
    expect(securityRow.cv_visible_recruteurs, "La valeur de security ne doit jamais avoir bougé.").toBe(false);
  });

  test("aucun backfill : la valeur par défaut reste false pour un profil qui vient d'être créé", async () => {
    const rows = await runPrivilegedSql(
      `SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='cv_visible_recruteurs';`
    );
    expect(rows[0].column_default).toBe("false");
  });
});
