const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const { runPrivilegedSql } = require("../helpers/privilegedSql");
const { loadTestEnv } = require("../helpers/testEnv");

/**
 * Correctif escalade de privilèges (2026-08-02, sur commit e5fe703) :
 * publisher pouvait approuver/rejeter/révoquer des badges — un publisher
 * complice pouvait s'auto-approuver l'accès à la CVthèque. Et
 * `official_staff` servait de deuxième source de vérité pour l'accès
 * /admin (middleware.js), en plus de role='publisher'. Les deux corrigés :
 * approve/reject_badge_request/revoke_badge sont admin-only (vérifié à
 * l'intérieur de la fonction, pas seulement supposé), et badges n'est plus
 * jamais lu pour une décision d'autorisation nulle part dans le code.
 */


// Exécute du SQL privilégié via la CLI Supabase (connexion superuser, hors
// PostgREST/authenticated) — le seul moyen légitime d'attribuer
// official_staff, volontairement non exposé par aucune fonction RPC (voir
// docs/acces-secours.md). Utilisé ici pour reproduire fidèlement ce
// qu'un admin ferait en SQL direct, pas un raccourci de test.
const CANDIDATE_EMAIL = process.env.E2E_CANDIDATE_EMAIL || "e2e-test-candidate@facilite-demo.local";
const CANDIDATE_PASSWORD = process.env.E2E_CANDIDATE_PASSWORD || "FaciliteE2ETest2026!";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "e2e-test-admin@facilite-demo.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "FaciliteE2ETest2026!";
// e2e-test-agent a role='publisher' depuis le backfill RBAC (20260802050000 :
// agent -> publisher) — réutilisé ici plutôt que de créer un nouveau compte
// (orphelin impossible à nettoyer sans service_role, absent en local).
const PUBLISHER_EMAIL = process.env.E2E_PUBLISHER_EMAIL || "e2e-test-agent@facilite-demo.local";
const PUBLISHER_PASSWORD = process.env.E2E_PUBLISHER_PASSWORD || "FaciliteE2ETest2026!";

test.describe("RBAC — correctif escalade de privilèges (badges)", () => {
  let candidateClient;
  let adminClient;
  let publisherClient;
  let candidateId;
  let requestId;

  test.beforeAll(async () => {
    const env = loadTestEnv();
    candidateClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    publisherClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    const { data: candAuth, error: candErr } = await candidateClient.auth.signInWithPassword({
      email: CANDIDATE_EMAIL,
      password: CANDIDATE_PASSWORD,
    });
    expect(candErr, `Connexion candidat échouée : ${candErr?.message}`).toBeNull();
    candidateId = candAuth.user.id;

    const { error: adminErr } = await adminClient.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    expect(adminErr, `Connexion admin échouée : ${adminErr?.message}`).toBeNull();

    const { data: pubAuth, error: pubErr } = await publisherClient.auth.signInWithPassword({
      email: PUBLISHER_EMAIL,
      password: PUBLISHER_PASSWORD,
    });
    expect(pubErr, `Connexion publisher échouée : ${pubErr?.message}`).toBeNull();

    // Vérifie la prémisse du test avant de s'en servir : ce compte doit
    // réellement être 'publisher', pas un autre rôle par accident.
    const { data: pubRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", pubAuth.user.id)
      .single();
    expect(pubRole?.role, "Le compte de test publisher n'a pas role='publisher'.").toBe("publisher");
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
  });

  test("un utilisateur ne peut pas déposer une demande pour 'official_staff'", async () => {
    const { error } = await candidateClient.from("badge_requests").insert({
      user_id: candidateId,
      requested_badge: "official_staff",
      company_name: "N/A",
      ninea_number: "0000000000000",
      rccm_number: "SN.DKR.2026.A.00000",
    });
    expect(error, "official_staff a été accepté comme badge demandable.").not.toBeNull();
    expect(error.message).toContain("badge_requests_requested_badge_check");
  });

  test("un publisher ne peut pas approuver une demande de badge", async () => {
    const { data: created, error: insertError } = await candidateClient
      .from("badge_requests")
      .insert({
        user_id: candidateId,
        requested_badge: "verified_recruiter",
        company_name: "Test Escalade SARL",
        ninea_number: "1231231231231",
        rccm_number: "SN.DKR.2026.A.33333",
      })
      .select()
      .single();
    expect(insertError, `Insertion demande échouée : ${insertError?.message}`).toBeNull();
    requestId = created.id;

    const { data: approved, error } = await publisherClient.rpc("approve_badge_request", { request_id: requestId });
    expect(error, "Un publisher a réussi à appeler approve_badge_request().").not.toBeNull();
    expect(approved == null || approved === false, "approve_badge_request() a retourné true pour un publisher.").toBe(true);

    const { data: request } = await adminClient.from("badge_requests").select("status").eq("id", requestId).single();
    expect(request.status, "Le statut a changé malgré le rejet de l'appel.").toBe("pending");
  });

  test("un publisher ne peut pas rejeter une demande de badge", async () => {
    const { error } = await publisherClient.rpc("reject_badge_request", {
      request_id: requestId,
      reason: "Tentative non autorisée",
    });
    expect(error, "Un publisher a réussi à appeler reject_badge_request().").not.toBeNull();
  });

  test("un publisher ne peut pas révoquer un badge", async () => {
    // Approuve d'abord légitimement (admin) pour avoir quelque chose à
    // tenter de révoquer.
    const { data: approved, error: approveError } = await adminClient.rpc("approve_badge_request", {
      request_id: requestId,
    });
    expect(approveError).toBeNull();
    expect(approved).toBe(true);

    const { error } = await publisherClient.rpc("revoke_badge", {
      target_user_id: candidateId,
      badge_name: "verified_recruiter",
      reason: "Tentative non autorisée",
    });
    expect(error, "Un publisher a réussi à appeler revoke_badge().").not.toBeNull();

    const { data: hasIt } = await adminClient.rpc("has_badge", {
      check_user_id: candidateId,
      badge_name: "verified_recruiter",
    });
    expect(hasIt, "Le badge a été révoqué malgré le rejet de l'appel.").toBe(true);
  });

  test("un publisher ne peut pas non plus écrire directement sur badge_requests (contournement du GRANT)", async () => {
    const { error } = await publisherClient
      .from("badge_requests")
      .update({ status: "approved" })
      .eq("id", requestId);
    expect(error, "Une écriture directe (hors fonction) sur badge_requests a réussi pour un publisher.").not.toBeNull();
  });

  test("un compte avec le badge cosmétique official_staff mais sans role='publisher' n'accède pas à la file de modération", async () => {
    // Le candidat de test a role='user'. official_staff ne s'attribue
    // jamais via une fonction RPC (retiré du CHECK de badge_requests,
    // aucune fonction "grant" générique) — seul un accès SQL direct
    // (docs/acces-secours.md) le peut. Reproduit ici fidèlement via la CLI,
    // pas un raccourci applicatif.
    //
    // Un candidat voit toujours SA PROPRE demande (clause légitime
    // "auth.uid() = user_id" de la policy SELECT) : ce n'est pas ce qu'on
    // teste. On vérifie qu'il ne voit pas la demande de quelqu'un d'autre —
    // ici celle déposée par le compte admin de test lui-même, pour avoir
    // une ligne tierce réelle plutôt qu'une table vide (un test qui passe
    // sur une table vide ne prouve rien).
    const { data: adminAuthUser } = await adminClient.auth.getUser();
    const otherUserId = adminAuthUser.user.id;
    await runPrivilegedSql(
      `INSERT INTO public.badge_requests (user_id, requested_badge, company_name, ninea_number, rccm_number)
       VALUES ('${otherUserId}', 'verified_recruiter', 'Autre Compte SARL', '1112223334446', 'SN.DKR.2026.A.44444');`
    );
    await runPrivilegedSql(
      `UPDATE public.profiles SET badges = badges || '["official_staff"]'::jsonb WHERE id = '${candidateId}';`
    );

    try {
      const { data, error } = await candidateClient.from("badge_requests").select("*").neq("user_id", candidateId);
      expect(error).toBeNull();
      expect(
        data,
        "Un compte role='user' avec le badge official_staff a pu lire la demande d'un autre utilisateur."
      ).toEqual([]);
    } finally {
      await runPrivilegedSql(
        `UPDATE public.profiles SET badges = badges - 'official_staff' WHERE id = '${candidateId}';
         DELETE FROM public.badge_requests WHERE user_id = '${otherUserId}';`
      );
    }
  });
});
