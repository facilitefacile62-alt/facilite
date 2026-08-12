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
    page.on('console', msg => {
      console.log(`BROWSER_LOG [${msg.type()}]: ${msg.text()}`);
    });

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

    // Cliquer sur le bouton Détails
    const detailsBtn = card.locator('a:has-text("Détails")');
    await expect(detailsBtn).toBeVisible();
    await detailsBtn.click();
    await page.waitForURL(`**/offres/${testOfferId}`, { timeout: 15000 });

    // 3. Modifier l'offre
    const editBtn = page.locator('button[title="Modifier l\'offre"]');
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // Vérifier les champs du formulaire d'édition
    const titleInput = page.locator('input[placeholder="Ex. Développeur Full-Stack"]');
    const companyInput = page.locator('input[placeholder="Ex. Tech Solutions Inc."]');
    const locationInput = page.locator('input[placeholder="Ex. Dakar, Sénégal"]');
    const descriptionTextarea = page.locator('textarea');

    await expect(titleInput).toHaveValue("Offre Test E2E Edition");
    await expect(companyInput).toHaveValue("Test Company Inc.");
    await expect(locationInput).toHaveValue("Dakar");
    await expect(descriptionTextarea).toHaveValue("Description initiale de l'offre test E2E.");

    // Remplir avec les nouvelles valeurs
    const newTitle = "Offre Test E2E Modifiée";
    const newCompany = "Test Company Modifiée Inc.";
    const newLocation = "Dakar-Fann";
    const newDescription = "Description modifiée de l'offre test E2E par l'admin.";
    const newEmail = "test-contact@entreprise.com";
    const newLink = "https://entreprise.com/test-apply";

    await titleInput.fill(newTitle);
    await companyInput.fill(newCompany);
    await locationInput.fill(newLocation);
    await descriptionTextarea.fill(newDescription);
    await page.locator('input[placeholder="Ex. contact@entreprise.com"]').fill(newEmail);
    await page.locator('input[placeholder="Ex. https://entreprise.com/apply"]').fill(newLink);

    // Enregistrer
    const saveBtn = page.locator('button:has-text("Enregistrer")');
    await saveBtn.click();

    // Vérifier que le formulaire est fermé et que l'affichage est mis à jour
    await expect(titleInput).not.toBeVisible();
    await expect(page.locator(`h1:has-text("${newTitle}")`)).toBeVisible();
    await expect(page.locator(`p:has-text("${newCompany}")`).first()).toBeVisible();
    await expect(page.locator(`span:has-text("${newLocation}")`).first()).toBeVisible();
    await expect(page.locator(`div:has-text("${newDescription}")`).first()).toBeVisible();
    await expect(page.locator(`text=Contact : ${newEmail}`)).toBeVisible();
    await expect(page.locator(`text=Lien externe : ${newLink}`)).toBeVisible();

    // 4. Supprimer (archiver) l'offre
    const deleteBtn = page.locator('button[title="Supprimer l\'offre"]');
    await expect(deleteBtn).toBeVisible();

    // Dialog handler pour accepter la confirmation et l'alerte de succès
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'confirm') {
        expect(dialog.message()).toContain("supprimer / archiver cette offre d'emploi");
        await dialog.accept();
      } else if (dialog.type() === 'alert') {
        expect(dialog.message()).toContain("supprimée avec succès");
        await dialog.accept();
      }
    });

    await deleteBtn.click();

    // Devrait être redirigé vers /offres et la carte ne doit plus exister
    await page.waitForURL("**/offres", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    const deletedCard = page.locator(`.group:has-text("${newTitle}")`).first();
    await expect(deletedCard).not.toBeVisible();
  });
});
