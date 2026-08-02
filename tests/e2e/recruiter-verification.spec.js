const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

/**
 * SUSPENDU (2026-08-02) — le chantier RBAC (user/publisher/admin,
 * 20260802050000 et suivantes) a supprimé profiles.role et, avec lui,
 * candidats_recherche (dépendait de role='candidat' en dur) : la fonctionnalité
 * que ce test protège est déjà hors service, indépendamment de ce fichier.
 *
 * Le setup de ce test (bascule recruiter_verified via le client admin,
 * ligne "await adminClient.from('profiles').update({ recruiter_verified })")
 * échoue désormais aussi, pour une raison distincte trouvée en le relançant
 * après 20260802060000 (deny-by-default sur profiles) : recruiter_verified
 * n'est plus dans la liste des colonnes GRANTées à authenticated, et est de
 * toute façon protégée par trg_protect_cosmetic_columns depuis 20260802051000
 * (silencieusement, avant même ce GRANT). Ce n'est pas une régression du
 * GRANT — la même écriture échouait déjà silencieusement avant lui. Le bouton
 * "Valider" de l'admin (src/app/admin/page.js, handleVerifyRecruiter) fait
 * exactement le même appel client et est donc, lui aussi, déjà inopérant.
 *
 * À reconstruire entièrement sur badge_requests (section 4/5), pas à
 * réparer tel quel : la logique métier "recruteur vérifié" elle-même
 * n'existe plus sous cette forme dans le nouveau modèle de rôles.
 *
 * Régression originale pour l'audit sécurité (référentiel 101-150, points
 * 121+122) : n'importe quel compte auto-inscrit "recruteur" pouvait
 * interroger candidats_recherche sans aucune vérification et en obtenir
 * l'intégralité en un appel.
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

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "e2e-test-admin@facilite-demo.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "FaciliteE2ETest2026!";
const RECRUITER_EMAIL = process.env.E2E_RECRUITER_EMAIL || "demo.senetech@facilite-demo.local";
const RECRUITER_PASSWORD = process.env.E2E_RECRUITER_PASSWORD || "FaciliteDemo2026!";

test.describe.skip("Sécurité — vérification recruteur avant accès à la CVthèque (suspendu, voir commentaire d'en-tête)", () => {
  let env;
  let adminClient;
  let recruiterClient;
  let recruiterId;
  let recruiterAccessToken;

  test.beforeAll(async () => {
    env = loadEnvLocal();
    adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    recruiterClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    const [{ error: adminErr }, { data: recruiterAuth, error: recruiterErr }] = await Promise.all([
      adminClient.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      recruiterClient.auth.signInWithPassword({ email: RECRUITER_EMAIL, password: RECRUITER_PASSWORD }),
    ]);
    expect(adminErr, `Connexion admin échouée : ${adminErr?.message}`).toBeNull();
    expect(recruiterErr, `Connexion recruteur échouée : ${recruiterErr?.message}`).toBeNull();

    recruiterId = recruiterAuth.user.id;
    recruiterAccessToken = recruiterAuth.session.access_token;

    // Le compte de démo est grandfathered "true" par la migration — on part
    // bien d'un état vérifié connu avant de le faire varier.
    const { error } = await adminClient
      .from("profiles")
      .update({ recruiter_verified: true })
      .eq("id", recruiterId);
    expect(error).toBeNull();
  });

  test.afterAll(async () => {
    if (adminClient && recruiterId) {
      await adminClient.from("profiles").update({ recruiter_verified: true }).eq("id", recruiterId);
    }
  });

  test("un recruteur non vérifié ne reçoit aucun candidat", async ({ request }) => {
    const { error } = await adminClient.from("profiles").update({ recruiter_verified: false }).eq("id", recruiterId);
    expect(error).toBeNull();

    const response = await request.get("/api/recruteur/candidats-recherche", {
      headers: { Authorization: `Bearer ${recruiterAccessToken}` },
    });
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.candidates.length, "Un recruteur non vérifié a reçu des candidats.").toBe(0);
  });

  test("un recruteur non vérifié ne peut pas s'auto-approuver", async () => {
    const { error: adminSetErr } = await adminClient.from("profiles").update({ recruiter_verified: false }).eq("id", recruiterId);
    expect(adminSetErr).toBeNull();

    // Tentative d'auto-escalade : exactement ce qu'un attaquant ferait
    // depuis la console du navigateur avec sa propre session.
    await recruiterClient.from("profiles").update({ recruiter_verified: true }).eq("id", recruiterId);

    const { data: profile, error: readErr } = await adminClient
      .from("profiles")
      .select("recruiter_verified")
      .eq("id", recruiterId)
      .single();

    expect(readErr).toBeNull();
    expect(
      profile.recruiter_verified,
      "Le recruteur a réussi à s'auto-approuver malgré le trigger anti-escalade."
    ).toBe(false);
  });

  test("un recruteur vérifié reçoit le répertoire candidats, paginé", async ({ request }) => {
    const { error } = await adminClient.from("profiles").update({ recruiter_verified: true }).eq("id", recruiterId);
    expect(error).toBeNull();

    const response = await request.get("/api/recruteur/candidats-recherche?pageSize=1000", {
      headers: { Authorization: `Bearer ${recruiterAccessToken}` },
    });
    expect(response.ok()).toBe(true);
    const body = await response.json();

    expect(
      body.candidates.length,
      "pageSize=1000 n'a pas été plafonné côté serveur."
    ).toBeLessThanOrEqual(30);
  });
});
