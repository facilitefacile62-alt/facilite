const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const { loadTestEnv } = require("../helpers/testEnv");

/**
 * « Postuler via Facilité » : tant que le JavaScript de la page n'est pas chargé (réseau lent), le bouton est affiché par
 * le rendu serveur mais ne peut rien faire — il apparaît donc désactivé, avec un indicateur « Chargement… », puis devient
 * actif. On simule le réseau lent en bloquant les scripts de la page.
 */
test.use({ viewport: { width: 390, height: 844 } });

test.describe("Bouton « Postuler » pendant le chargement", () => {
  test.setTimeout(120_000);
  let admin;
  let compte;
  let offreId;
  let adminId;

  test.beforeAll(async () => {
    const env = loadTestEnv();
    admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data, error } = await admin.auth.admin.createUser({ email: `e2e-chargement-${Date.now()}@facilite-demo.local`, password: `Charg-${Date.now()}-Aa1!`, email_confirm: true });
    expect(error).toBeNull();
    compte = data.user;
    await new Promise((r) => setTimeout(r, 3500));
    const { data: o, error: e2 } = await admin
      .from("job_offers")
      .insert({ title: `E2E chargement ${Date.now()}`, company: "Entreprise E2E", location: "Dakar", description: "Offre de test.", contact_email: "contact@facilite-demo.local", recruiter_id: compte.id, is_active: true })
      .select("id")
      .single();
    expect(e2).toBeNull();
    offreId = o.id;
    // Approbation par un administrateur de test (la modération passe par la fonction moderate_job_offer, réservée aux admins).
    const emailAdmin = `e2e-admin-${Date.now()}@facilite-demo.local`;
    const mdpAdmin = `Admin-${Date.now()}-Aa1!`;
    const { data: a, error: e3 } = await admin.auth.admin.createUser({ email: emailAdmin, password: mdpAdmin, email_confirm: true });
    expect(e3).toBeNull();
    adminId = a.user.id;
    await admin.from("user_roles").upsert({ user_id: adminId, role: "admin", status: "active" });
    const clientAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await clientAdmin.auth.signInWithPassword({ email: emailAdmin, password: mdpAdmin });
    const { error: e4 } = await clientAdmin.rpc("moderate_job_offer", { offer_id: offreId, decision: "approved" });
    expect(e4).toBeNull();
  });
  test.afterAll(async () => {
    if (offreId) await admin.from("job_offers").delete().eq("id", offreId);
    if (compte) await admin.auth.admin.deleteUser(compte.id);
    if (adminId) await admin.auth.admin.deleteUser(adminId);
  });

  test("désactivé avec « Chargement… » avant l'hydratation, actif ensuite", async ({ page }) => {
    // Scripts bloqués : seul le rendu serveur est visible, comme sur un réseau très lent.
    await page.route("**/_next/static/**/*.js", (route) => route.abort());
    await page.goto(`/offres/${offreId}`);
    const bouton = page.getByRole("button", { name: /Chargement/ }).first();
    await expect(bouton).toBeVisible({ timeout: 30_000 });
    await expect(bouton).toBeDisabled();

    await page.unroute("**/_next/static/**/*.js");
    await page.goto(`/offres/${offreId}`);
    const actif = page.getByRole("button", { name: /Postuler via Facilité/ }).first();
    await expect(actif).toBeVisible({ timeout: 60_000 });
    await expect(actif).toBeEnabled();
  });
});
