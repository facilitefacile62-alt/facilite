const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const { loadTestEnv } = require("../helpers/testEnv");

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "e2e-test-admin@facilite-demo.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "FaciliteE2ETest2026!";

test.describe("Catalogue - Édition et suppression d'offres", () => {
  let supabaseAdmin;
  let testOfferId;
  let testRecruiterId;

  test.beforeAll(async () => {
    const env = loadTestEnv();
    supabaseAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    
    // Sign in to get admin userId
    const { data: authData } = await supabaseAdmin.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    testRecruiterId = authData.user.id;

    // Create a temporary offer for our test
    const { data: offer, error } = await supabaseAdmin
      .from("job_offers")
      .insert({
        title: "Offre Test E2E Edition",
        company: "Test Company Inc.",
        description: "Description initiale de l'offre test E2E.",
        location: "Dakar",
        contract_type: "CDI",
        recruiter_id: testRecruiterId,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw new Error("Failed to insert test job offer: " + error.message);
    testOfferId = offer.id;

    const { runPrivilegedSql } = require("../helpers/privilegedSql");
    await runPrivilegedSql(`
      ALTER TABLE public.job_offers DISABLE TRIGGER trg_reset_job_offer_moderation;
      UPDATE public.job_offers
      SET status = 'approved', is_test_account = false
      WHERE id = '${testOfferId}';
      ALTER TABLE public.job_offers ENABLE TRIGGER trg_reset_job_offer_moderation;
    `);
  });

  test.afterAll(async () => {
    if (testOfferId) {
      // Clean up directly via SQL or supabase admin if still exists
      const { runPrivilegedSql } = require("../helpers/privilegedSql");
      await runPrivilegedSql(`DELETE FROM public.job_offers WHERE id = '${testOfferId}';`).catch(() => {});
    }
  });

  test("un admin peut modifier et supprimer la description d'une offre", async ({ page }) => {
    // 1. Connexion en tant qu'admin
    await page.goto("/login");
    await page.getByPlaceholder("Enter your Email").fill(ADMIN_EMAIL);
    await page.getByPlaceholder("Enter your password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Log In" }).click();
    await page.waitForURL("**/messagerie", { timeout: 20000 });

    // 2. Aller sur le catalogue d'offres
    await page.goto("/offres");
    await page.waitForLoadState("networkidle");


    // Trouver le sélecteur ou la carte de notre offre
    const card = page.locator(`.group:has-text("Offre Test E2E Edition")`).first();
    await expect(card).toBeVisible();

    // Cliquer sur le bouton modifier (le crayon)
    const editBtn = card.locator('button[title="Modifier la description"]');
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // Le textarea doit apparaître
    const textarea = card.locator('textarea');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveValue("Description initiale de l'offre test E2E.");

    // Modifier la description
    const newDescription = "Description modifiee de l'offre test E2E par l'admin.";
    await textarea.fill(newDescription);

    // Cliquer sur enregistrer
    const saveBtn = card.locator('button:has-text("Enregistrer")');
    await saveBtn.click();

    // Le textarea doit disparaître et la nouvelle description s'afficher
    await expect(textarea).not.toBeVisible();
    await expect(card.locator(`text=${newDescription}`)).toBeVisible();

    // 3. Supprimer (archiver) l'offre
    const deleteBtn = card.locator('button[title="Supprimer l\'offre"]');
    await expect(deleteBtn).toBeVisible();

    // Dialog handler pour accepter la confirmation
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain("Retirer définitivement cette offre");
      await dialog.accept();
    });

    await deleteBtn.click();

    // La carte de l'offre doit disparaître de la page
    await expect(card).not.toBeVisible();
  });
});
