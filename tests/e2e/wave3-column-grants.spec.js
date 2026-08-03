const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const { runPrivilegedSql } = require("../helpers/privilegedSql");

/**
 * Vague 3 (Partie 1 du chantier, docs/grants-matrix.md) : UPDATE
 * authenticated est restreint aux colonnes justifiées, table par table.
 * Ce fichier prouve la fermeture spécifique la plus notable : le
 * mass-assignment { ...offerForm } sur job_offers (recruteur/page.js:625,
 * repéré dès l'audit initial et jamais corrigé jusqu'ici) est désormais
 * bloqué au niveau PostgreSQL — un appel API direct avec la clé anon ne
 * peut plus écrire recruiter_id ni embedding, même sur sa PROPRE offre.
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

test.describe("Vague 3 — colonnes UPDATE restreintes (job_offers)", () => {
  let candidateClient, securityClient;
  let candidateId, securityId, offerId;

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

    // Étape D (2026-08-03) : créer une offre exige désormais le badge
    // verified_recruiter (20260803110000_badge_gate_espace_recruteur.sql) —
    // accordé pour la durée de ce fichier seulement (workers:1 dans
    // playwright.config.js, exécution séquentielle, jamais en parallèle
    // avec recruiter-search-views.spec.js qui exige ce même compte NON badgé).
    await runPrivilegedSql(`
      UPDATE public.profiles SET badges = badges || '["verified_recruiter"]'::jsonb
      WHERE id = '${candidateId}' AND NOT (badges @> '["verified_recruiter"]'::jsonb);
    `);

    const { data: offer } = await candidateClient
      .from("job_offers")
      .insert({ title: "Offre test Vague 3", company: "Test SARL", location: "Dakar", recruiter_id: candidateId, is_active: true })
      .select()
      .single();
    offerId = offer.id;
  });

  test.afterAll(async () => {
    // Étapes indépendantes (.catch) : voir docs/diagnostic-tests-bloquants.md.
    if (offerId) {
      const { error } = await candidateClient.rpc("archive_own_job_offer", { offer_id: offerId });
      if (error) console.error("Nettoyage échoué (non bloquant) :", error.message);
    }
    await runPrivilegedSql(`UPDATE public.profiles SET badges = badges - 'verified_recruiter' WHERE id = '${candidateId}';`).catch((e) =>
      console.error("Nettoyage échoué (non bloquant) :", e.message)
    );
  });

  test("le propriétaire peut toujours modifier les champs légitimes de son offre", async () => {
    const { error } = await candidateClient
      .from("job_offers")
      .update({ title: "Titre modifié", description: "Nouvelle description" })
      .eq("id", offerId);
    expect(error).toBeNull();

    const { data } = await candidateClient.from("job_offers").select("title").eq("id", offerId).single();
    expect(data.title).toBe("Titre modifié");
  });

  test("le propriétaire NE PEUT PLUS écrire embedding directement sur sa propre offre", async () => {
    const { error } = await candidateClient
      .from("job_offers")
      .update({ embedding: "[0.1,0.2,0.3]" })
      .eq("id", offerId);
    expect(error, "embedding doit être refusé — calcul serveur uniquement (voir Étape 2C).").not.toBeNull();
  });

  test("le propriétaire NE PEUT PLUS réassigner recruiter_id (vol d'offre) même sur sa propre ligne", async () => {
    const { error } = await candidateClient
      .from("job_offers")
      .update({ recruiter_id: securityId })
      .eq("id", offerId);
    expect(error, "recruiter_id doit être refusé — c'était le mass-assignment { ...offerForm } jamais corrigé.").not.toBeNull();

    const { data } = await candidateClient.from("job_offers").select("recruiter_id").eq("id", offerId).single();
    expect(data.recruiter_id).toBe(candidateId);
  });

  test("un tiers ne peut pas modifier une offre qui ne lui appartient pas (colonne pourtant autorisée)", async () => {
    const { error, count } = await securityClient
      .from("job_offers")
      .update({ title: "Piraté" }, { count: "exact" })
      .eq("id", offerId);
    if (!error) {
      expect(count, "La RLS doit bloquer l'écriture même si la colonne 'title' est autorisée au niveau GRANT.").toBe(0);
    }
    const { data } = await candidateClient.from("job_offers").select("title").eq("id", offerId).single();
    expect(data.title).not.toBe("Piraté");
  });
});
