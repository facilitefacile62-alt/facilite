const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const { runPrivilegedSql } = require("../helpers/privilegedSql");

/**
 * Étape D du chantier (2026-08-03) : verified_recruiter conditionne
 * désormais TOUT l'espace recruteur (offres, candidatures, profil vitrine),
 * pas seulement la CVthèque — 20260803110000_badge_gate_espace_recruteur.sql.
 * Un compte 'user' sans badge ne doit obtenir AUCUN accès à aucune des
 * ressources de cet espace, testé directement contre l'API avec sa propre
 * clé anon (pas une simulation de l'UI).
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

test.describe("Bascule badge — tout l'espace recruteur gated (RLS)", () => {
  let securityClient, adminClient;
  let securityId, adminId;
  let preexistingOfferId, badgeRequestId;

  test.beforeAll(async () => {
    const env = loadEnvLocal();
    securityClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    const { data: secAuth } = await securityClient.auth.signInWithPassword({ email: SECURITY_EMAIL, password: SECURITY_PASSWORD });
    securityId = secAuth.user.id;
    const { data: adminAuth } = await adminClient.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    adminId = adminAuth.user.id;

    // Une offre créée en amont (SQL privilégié, hors RLS) pour prouver que
    // même une offre PRÉEXISTANTE devient invisible/non modifiable sans
    // badge — pas seulement la création de nouvelles offres.
    const rows = await runPrivilegedSql(`
      INSERT INTO public.job_offers (title, company, location, recruiter_id, status, is_active)
      VALUES ('Offre préexistante gate test', 'Test SARL', 'Dakar', '${securityId}', 'approved', true)
      RETURNING id;
    `);
    preexistingOfferId = rows[0].id;
  });

  test.afterAll(async () => {
    // Étapes indépendantes (.catch) : un flake CLI sur les deux premières ne
    // doit jamais empêcher revoke_badge de s'exécuter — c'est exactement ce
    // qui a laissé securityId badgé et fait échouer
    // storage-role-literals-fix.spec.js en aval le 2026-08-03, voir
    // docs/diagnostic-tests-bloquants.md.
    if (preexistingOfferId) {
      await runPrivilegedSql(`DELETE FROM public.job_offers WHERE id = '${preexistingOfferId}';`).catch((e) =>
        console.error("Nettoyage échoué (non bloquant) :", e.message)
      );
    }
    if (badgeRequestId) {
      await runPrivilegedSql(`DELETE FROM public.badge_requests WHERE id = '${badgeRequestId}';`).catch((e) =>
        console.error("Nettoyage échoué (non bloquant) :", e.message)
      );
    }
    await adminClient.rpc("revoke_badge", { target_user_id: securityId, badge_name: "verified_recruiter", reason: "Nettoyage post-test" });
  });

  test("sans badge : ni création, ni lecture, ni modification d'offre — même une offre déjà possédée", async () => {
    const { error: insertErr } = await securityClient
      .from("job_offers")
      .insert({ title: "Nouvelle offre sans badge", company: "Test SARL", location: "Dakar", recruiter_id: securityId });
    expect(insertErr, "La création d'offre doit être refusée sans badge.").not.toBeNull();

    const { data: readData } = await securityClient.from("job_offers").select("id").eq("id", preexistingOfferId).maybeSingle();
    expect(readData, "Une offre préexistante ne doit plus être lisible par son propriétaire sans badge.").toBeNull();

    const { error: updateErr, count } = await securityClient
      .from("job_offers")
      .update({ title: "Modifiée sans badge" }, { count: "exact" })
      .eq("id", preexistingOfferId);
    if (!updateErr) expect(count, "Aucune ligne ne doit être modifiable sans badge.").toBe(0);
  });

  test("sans badge : get_recruiter_candidatures() renvoie systématiquement vide, même pour une offre possédée", async () => {
    const { data, error } = await securityClient.rpc("get_recruiter_candidatures", { p_job_offer_id: preexistingOfferId });
    expect(error).toBeNull();
    expect(data, "Aucune candidature ne doit être renvoyée sans badge, même pour sa propre offre.").toEqual([]);
  });

  test("sans badge : profil vitrine recruteur non créable", async () => {
    const { error } = await securityClient
      .from("recruiter_profiles")
      .insert({ user_id: securityId, company_name: "Test SARL sans badge" });
    expect(error, "La création d'un profil vitrine doit être refusée sans badge.").not.toBeNull();
  });

  test("après badge : les mêmes actions redeviennent possibles pour le même compte", async () => {
    const { data: created, error: reqErr } = await securityClient
      .from("badge_requests")
      .insert({
        user_id: securityId,
        requested_badge: "verified_recruiter",
        company_name: "Badge Gate Test SARL",
        ninea_number: "9998887776665",
        rccm_number: "SN.DKR.2026.A.99999",
      })
      .select()
      .single();
    expect(reqErr).toBeNull();
    badgeRequestId = created.id;

    const { data: approved, error: approveErr } = await adminClient.rpc("approve_badge_request", { request_id: badgeRequestId });
    expect(approveErr).toBeNull();
    expect(approved).toBe(true);

    const { data: readData, error: readErr } = await securityClient.from("job_offers").select("id").eq("id", preexistingOfferId).maybeSingle();
    expect(readErr).toBeNull();
    expect(readData?.id).toBe(preexistingOfferId);

    const { data: rpcData, error: rpcErr } = await securityClient.rpc("get_recruiter_candidatures", { p_job_offer_id: preexistingOfferId });
    expect(rpcErr).toBeNull();
    expect(Array.isArray(rpcData)).toBe(true);
  });

  test("un admin accède à l'espace recruteur sans avoir besoin du badge (supervision)", async () => {
    const { data, error } = await adminClient.from("job_offers").select("id").limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});
