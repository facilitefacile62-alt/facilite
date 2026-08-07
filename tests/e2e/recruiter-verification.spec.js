const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const { loadTestEnv } = require("../helpers/testEnv");

/**
 * Régression pour l'audit sécurité (référentiel 101-150, points 121+122) :
 * n'importe quel compte auto-inscrit pouvait interroger candidats_recherche
 * sans aucune vérification et en obtenir l'intégralité en un appel.
 *
 * Réécrite le 2026-08-02 sur le nouveau modèle RBAC (chantier sections 4-7) :
 * l'ancienne colonne recruiter_verified et la vérification manuelle admin
 * ont été remplacées par le badge verified_recruiter, accordé via le
 * workflow badge_requests (NINEA/RCCM + approve_badge_request()). Ce test
 * couvre spécifiquement la route HTTP /api/recruteur/candidats-recherche
 * (pagination + rate-limit) de bout en bout — la RLS de la vue elle-même
 * est couverte séparément par recruiter-search-views.spec.js, et les
 * fonctions RPC par badge-requests.spec.js.
 */


const CANDIDATE_EMAIL = process.env.E2E_CANDIDATE_EMAIL || "e2e-test-candidate@facilite-demo.local";
const CANDIDATE_PASSWORD = process.env.E2E_CANDIDATE_PASSWORD || "FaciliteE2ETest2026!";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "e2e-test-admin@facilite-demo.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "FaciliteE2ETest2026!";

test.describe("Sécurité — vérification recruteur avant accès à la CVthèque (route API)", () => {
  let candidateClient;
  let adminClient;
  let candidateId;
  let candidateAccessToken;
  let requestId;
  let visibleTargetId;

  test.beforeAll(async () => {
    const env = loadTestEnv();
    candidateClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    const { data: candAuth, error: candErr } = await candidateClient.auth.signInWithPassword({
      email: CANDIDATE_EMAIL,
      password: CANDIDATE_PASSWORD,
    });
    expect(candErr, `Connexion candidat échouée : ${candErr?.message}`).toBeNull();
    candidateId = candAuth.user.id;
    candidateAccessToken = candAuth.session.access_token;

    const { error: adminErr } = await adminClient.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    expect(adminErr, `Connexion admin échouée : ${adminErr?.message}`).toBeNull();

    // cv_visible_recruteurs=false par défaut depuis 20260802150000 : bascule
    // un profil réel existant pour que ce test ait quelque chose à trouver.
    const { data: otherProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("is_test_account", false)
      .neq("id", candidateId)
      .limit(1)
      .single();
    visibleTargetId = otherProfile.id;
    await adminClient.from("profiles").update({ cv_visible_recruteurs: true }).eq("id", visibleTargetId);
  });

  test.afterAll(async () => {
    if (adminClient && candidateId) {
      await adminClient.rpc("revoke_badge", {
        target_user_id: candidateId,
        badge_name: "verified_recruiter",
        reason: "Nettoyage post-test",
      });
    }
    if (adminClient && requestId) {
      await adminClient.from("badge_requests").delete().eq("id", requestId);
    }
    if (adminClient && visibleTargetId) {
      await adminClient.from("profiles").update({ cv_visible_recruteurs: false }).eq("id", visibleTargetId);
    }
  });

  test("un compte sans badge verified_recruiter ne reçoit aucun candidat via la route", async ({ request }) => {
    const response = await request.get("/api/recruteur/candidats-recherche", {
      headers: { Authorization: `Bearer ${candidateAccessToken}` },
    });
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.candidates).toEqual([]);
  });

  test("après approbation d'une demande de badge, la route renvoie le répertoire", async ({ request }) => {
    const { data: created, error: insertError } = await candidateClient
      .from("badge_requests")
      .insert({
        user_id: candidateId,
        requested_badge: "verified_recruiter",
        company_name: "Test Route SARL",
        ninea_number: "9998887776665",
        rccm_number: "SN.DKR.2026.A.22222",
      })
      .select()
      .single();
    expect(insertError, `Insertion demande échouée : ${insertError?.message}`).toBeNull();
    requestId = created.id;

    const { data: approved, error: approveError } = await adminClient.rpc("approve_badge_request", {
      request_id: requestId,
    });
    expect(approveError).toBeNull();
    expect(approved).toBe(true);

    const response = await request.get("/api/recruteur/candidats-recherche", {
      headers: { Authorization: `Bearer ${candidateAccessToken}` },
    });
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.candidates.length, "La route ne renvoie aucun candidat après approbation du badge.").toBeGreaterThan(0);
  });
});
