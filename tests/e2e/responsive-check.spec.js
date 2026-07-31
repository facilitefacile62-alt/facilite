const { test, expect } = require("@playwright/test");

const CANDIDATE_EMAIL = process.env.E2E_CANDIDATE_EMAIL || "e2e-test-candidate@facilite-demo.local";
const CANDIDATE_PASSWORD = process.env.E2E_CANDIDATE_PASSWORD || "FaciliteE2ETest2026!";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "e2e-test-admin@facilite-demo.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "FaciliteE2ETest2026!";

// Helper to check for horizontal scroll overflow
async function checkNoHorizontalOverflow(page) {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  const innerWidth = await page.evaluate(() => window.innerWidth);
  
  // Verify horizontal overflow is strictly 0px (scrollWidth <= clientWidth)
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  expect(innerWidth).toBeLessThanOrEqual(clientWidth);
}

test.describe("Tests de responsivité et de conformité Mobile UX", () => {
  
  // 1. Test Viewport 320px (Ultra-Small)
  test.describe("Viewport 320px - Petit Smartphone", () => {
    test.use({ viewport: { width: 320, height: 568 } });

    test("Pas de débordement horizontal sur les pages publiques", async ({ page }) => {
      // Page d'accueil
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await checkNoHorizontalOverflow(page);

      // Page de connexion
      await page.goto("/login");
      await page.waitForLoadState("networkidle");
      await checkNoHorizontalOverflow(page);

      // Créateur de CV (anonyme/initial)
      await page.goto("/creer-cv");
      await page.waitForLoadState("networkidle");
      await checkNoHorizontalOverflow(page);
    });

    test("Pas de débordement horizontal sur le Suivi Candidat (authentifié)", async ({ page }) => {
      // Connexion candidat
      await page.goto("/login");
      await page.getByPlaceholder("Enter your Email").fill(CANDIDATE_EMAIL);
      await page.getByPlaceholder("Enter your password").fill(CANDIDATE_PASSWORD);
      await page.getByRole("button", { name: "Log In" }).click();
      await page.waitForURL("**/messagerie", { timeout: 20_000 });
      await page.waitForLoadState("networkidle");

      // Suivi Candidat
      await page.goto("/candidat/candidatures");
      await page.waitForLoadState("networkidle");
      await checkNoHorizontalOverflow(page);
    });

    test("Pas de débordement horizontal sur le Dashboard Admin (authentifié)", async ({ page }) => {
      // Connexion admin
      await page.goto("/login");
      await page.getByPlaceholder("Enter your Email").fill(ADMIN_EMAIL);
      await page.getByPlaceholder("Enter your password").fill(ADMIN_PASSWORD);
      await page.getByRole("button", { name: "Log In" }).click();
      await page.waitForURL("**/admin", { timeout: 20_000 });
      await page.waitForLoadState("networkidle");

      // Dashboard Admin
      await page.goto("/admin/dashboard");
      await page.waitForLoadState("networkidle");
      await checkNoHorizontalOverflow(page);
    });
  });

  // 2. Test Viewport 375px (Mobile Standard)
  test.describe("Viewport 375px - Mobile Standard", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("Ouverture de la modale de tarification et du menu mobile", async ({ page }) => {
      // Accès au créateur de CV
      await page.goto("/creer-cv");
      await page.waitForLoadState("networkidle");

      // Ouvrir la modale de tarification en sélectionnant une formule d'exportation
      // Dans creer-cv, le bouton "Suivant" après l'étape finale déclenche l'ouverture de la PricingModal.
      // Cherchons les boutons à l'étape finale ou cliquons sur le bouton "Exporter" / "Télécharger"
      const exportBtn = page.getByRole("button", { name: /Télécharger|Exporter/i }).first();
      if (await exportBtn.count() > 0 && await exportBtn.first().isVisible()) {
        await exportBtn.first().click();
        
        // Attendre que la modale de tarification soit affichée
        const modal = page.locator('role=dialog');
        await expect(modal).toBeVisible();
        
        // Vérifier l'absence de débordement horizontal
        await checkNoHorizontalOverflow(page);
        
        // Fermer la modale
        const closeBtn = page.getByLabel("Fermer");
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
        } else {
          await page.keyboard.press("Escape");
        }
      }

      // Vérifier le menu burger / barre de navigation mobile sur la page d'accueil
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      
      const bottomNav = page.locator("nav");
      await expect(bottomNav).toBeVisible();
    });
  });

  // 3. Test Viewport 768px (Tablette) & 1280px (Desktop)
  test.describe("Différenciation Tablettes vs Desktop (Grilles & Colonnes)", () => {
    test("Disposition responsive sur tablette (768px)", async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      
      // Connexion admin
      await page.goto("/login");
      await page.getByPlaceholder("Enter your Email").fill(ADMIN_EMAIL);
      await page.getByPlaceholder("Enter your password").fill(ADMIN_PASSWORD);
      await page.getByRole("button", { name: "Log In" }).click();
      await page.waitForURL("**/admin", { timeout: 20_000 });
      
      await page.goto("/admin/dashboard");
      await page.waitForLoadState("networkidle");

      // Sur tablette, les cartes KPI ont 2 colonnes (sm:grid-cols-2), vérifier que le conteneur existe
      const kpiContainer = page.locator(".grid.grid-cols-1.sm\\:grid-cols-2");
      await expect(kpiContainer).toBeVisible();
    });

    test("Disposition responsive sur PC Desktop (1280px)", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      
      // Connexion admin
      await page.goto("/login");
      await page.getByPlaceholder("Enter your Email").fill(ADMIN_EMAIL);
      await page.getByPlaceholder("Enter your password").fill(ADMIN_PASSWORD);
      await page.getByRole("button", { name: "Log In" }).click();
      await page.waitForURL("**/admin", { timeout: 20_000 });
      
      await page.goto("/admin/dashboard");
      await page.waitForLoadState("networkidle");

      // Sur desktop, les cartes KPI ont 4 colonnes (lg:grid-cols-4), vérifier que le conteneur existe
      const kpiContainer = page.locator(".grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4");
      await expect(kpiContainer).toBeVisible();
    });
  });
});
