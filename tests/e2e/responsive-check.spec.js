const { test, expect } = require("@playwright/test");

const CANDIDATE_EMAIL = process.env.E2E_CANDIDATE_EMAIL || "e2e-test-candidate@facilite-demo.local";
const CANDIDATE_PASSWORD = process.env.E2E_CANDIDATE_PASSWORD || "FaciliteE2ETest2026!";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "e2e-test-admin@facilite-demo.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "FaciliteE2ETest2026!";

async function loginAs(page, email, password, expectedUrlPattern) {
  await page.goto("/login");
  await page.getByPlaceholder("Enter your Email").fill(email);
  await page.getByPlaceholder("Enter your password").fill(password);
  await page.getByRole("button", { name: "Log In" }).click();
  await page.waitForURL(expectedUrlPattern, { timeout: 20_000 });
  await page.waitForLoadState("networkidle");
}

// Débordement horizontal strictement nul : scrollWidth ne doit jamais
// dépasser clientWidth, quelle que soit la page.
async function expectNoHorizontalOverflow(page, label) {
  const { scrollWidth, clientWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    innerWidth: window.innerWidth,
  }));

  expect(scrollWidth - clientWidth, `${label} : débordement horizontal (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`).toBeLessThanOrEqual(0);
  expect(innerWidth, `${label} : innerWidth`).toBeLessThanOrEqual(clientWidth + 1);
}

test.describe("Tests de responsivité et de conformité Mobile UX", () => {
  // 1. Viewport 320px (Ultra-Small) — 0px de débordement sur les pages principales
  test.describe("Viewport 320px - Petit Smartphone", () => {
    test.use({ viewport: { width: 320, height: 568 } });

    test("Pages publiques : accueil, login", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await expectNoHorizontalOverflow(page, "/");

      await page.goto("/login");
      await page.waitForLoadState("networkidle");
      await expectNoHorizontalOverflow(page, "/login");
    });

    test("Créateur de CV, Suivi Candidat et Messagerie (candidat authentifié)", async ({ page }) => {
      // /creer-cv exige une session (absent de PUBLIC_ROUTES dans le
      // middleware) : un accès anonyme redirige vers /login avant même
      // d'atteindre la page, ce qui fausserait ce test sans connexion préalable.
      await loginAs(page, CANDIDATE_EMAIL, CANDIDATE_PASSWORD, "**/messagerie");
      await expectNoHorizontalOverflow(page, "/messagerie");

      await page.goto("/creer-cv");
      await page.waitForLoadState("networkidle");
      await expectNoHorizontalOverflow(page, "/creer-cv");

      await page.goto("/candidat/candidatures");
      await page.waitForLoadState("networkidle");
      await expectNoHorizontalOverflow(page, "/candidat/candidatures");
    });

    test("Dashboard Admin (admin authentifié)", async ({ page }) => {
      await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, "**/admin");

      await page.goto("/admin/dashboard");
      await page.waitForLoadState("networkidle");
      await expectNoHorizontalOverflow(page, "/admin/dashboard");
    });
  });

  // 2. Viewport 375px (Mobile Standard) — interactions : menu, modale, messagerie
  test.describe("Viewport 375px - Mobile Standard", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("Menu hamburger sur la page d'accueil", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Deux boutons "fa-bars" existent (dropdown desktop masqué + hamburger
      // mobile) : :visible filtre sur celui réellement affiché à ce viewport.
      const hamburgerButton = page.locator('button:has(i.fa-bars):visible').first();
      await expect(hamburgerButton).toBeVisible();
      await hamburgerButton.click();

      // Le menu mobile doit s'ouvrir et rester dans les limites de l'écran.
      await expectNoHorizontalOverflow(page, "/ (menu mobile ouvert)");
    });

    test("Modale de tarification (PricingModal) sur /creer-cv", async ({ page }) => {
      await loginAs(page, CANDIDATE_EMAIL, CANDIDATE_PASSWORD, "**/messagerie");
      await page.goto("/creer-cv");
      await page.waitForLoadState("networkidle");

      // Atteint l'étape finale du créateur de CV (handleNextStep incrémente
      // sans validation bloquante — 6 clics suffisent), puis ouvre la modale.
      for (let i = 0; i < 6; i++) {
        await page.getByRole("button", { name: "Continuer" }).click();
      }
      await page.getByRole("button", { name: "Télécharger mon CV (PDF)" }).first().click();

      const modal = page.getByRole("dialog");
      await expect(modal).toBeVisible();
      await expect(page.getByText("Finalisez votre CV")).toBeVisible();

      // Occupe toute la largeur disponible sur mobile, sans provoquer de débordement.
      await expectNoHorizontalOverflow(page, "/creer-cv (PricingModal ouverte)");
      const modalBox = await modal.boundingBox();
      expect(modalBox.width).toBeGreaterThan(375 * 0.85);

      // Bouton de fermeture toujours visible et accessible.
      const closeBtn = page.getByLabel("Fermer");
      await expect(closeBtn).toBeVisible();
      const closeBox = await closeBtn.boundingBox();
      expect(closeBox.width, "zone de toucher du bouton Fermer").toBeGreaterThanOrEqual(40);
      expect(closeBox.height, "zone de toucher du bouton Fermer").toBeGreaterThanOrEqual(40);

      await closeBtn.click();
      await expect(modal).not.toBeVisible();
    });

    test("Messagerie : ouverture d'une discussion puis retour via la flèche ←", async ({ page }) => {
      await loginAs(page, CANDIDATE_EMAIL, CANDIDATE_PASSWORD, "**/messagerie");
      await page.waitForLoadState("networkidle");

      const conversationList = page.locator("aside");

      // État initial : liste visible, chat masqué (aucune discussion active).
      await expect(conversationList).toBeVisible();

      // Ouvre la discussion épinglée (toujours présente, quel que soit l'historique du compte).
      // Scopé à la liste (aside) : "Assistance IA Facilite" apparaît aussi dans
      // l'en-tête du panneau de chat une fois la discussion active.
      await conversationList.getByText("Assistance IA Facilite").click();

      // Sur mobile, la liste doit se masquer au profit du panneau de chat.
      await expect(conversationList).toBeHidden();
      const backButton = page.locator("button:has(i.fa-arrow-left)").first();
      await expect(backButton).toBeVisible();
      await expectNoHorizontalOverflow(page, "/messagerie (discussion ouverte)");

      // Retour à la liste via la flèche ←.
      await backButton.click();
      await expect(conversationList).toBeVisible();
    });
  });

  // 3. Viewport 768px (Tablette) & 1280px (Desktop) — mise en page côte à côte
  test.describe("Tablette (768px) & Desktop (1280px)", () => {
    test("Tablette 768px : messagerie côte à côte + grille KPI 2 colonnes", async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      await loginAs(page, CANDIDATE_EMAIL, CANDIDATE_PASSWORD, "**/messagerie");
      await page.waitForLoadState("networkidle");

      // À partir de md (768px), liste ET chat sont visibles simultanément,
      // même sans discussion active (activeConvId ? "hidden md:flex" : "flex").
      const conversationList = page.locator("aside");
      await expect(conversationList).toBeVisible();
      await conversationList.getByText("Assistance IA Facilite").click();
      await expect(conversationList).toBeVisible();
      await expectNoHorizontalOverflow(page, "/messagerie@768px (discussion ouverte)");

      await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, "**/admin");
      await page.goto("/admin/dashboard");
      await page.waitForLoadState("networkidle");

      const kpiContainer = page.locator(".grid.grid-cols-1.sm\\:grid-cols-2");
      await expect(kpiContainer.first()).toBeVisible();
      await expectNoHorizontalOverflow(page, "/admin/dashboard@768px");
    });

    test("Desktop 1280px : messagerie côte à côte + grille KPI 4 colonnes", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });

      await loginAs(page, CANDIDATE_EMAIL, CANDIDATE_PASSWORD, "**/messagerie");
      await page.waitForLoadState("networkidle");

      const conversationList = page.locator("aside");
      await expect(conversationList).toBeVisible();
      await conversationList.getByText("Assistance IA Facilite").click();
      await expect(conversationList).toBeVisible();
      await expectNoHorizontalOverflow(page, "/messagerie@1280px (discussion ouverte)");

      await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, "**/admin");
      await page.goto("/admin/dashboard");
      await page.waitForLoadState("networkidle");

      const kpiContainer = page.locator(".grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4");
      await expect(kpiContainer.first()).toBeVisible();
      await expectNoHorizontalOverflow(page, "/admin/dashboard@1280px");
    });
  });

  // Règles d'ergonomie mobile : zoom iOS et zones de toucher.
  test.describe("Ergonomie mobile (375px)", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("Les champs de saisie du formulaire de connexion ont une taille de police >= 16px", async ({ page }) => {
      await page.goto("/login");
      await page.waitForLoadState("networkidle");

      const emailInput = page.getByPlaceholder("Enter your Email");
      const fontSize = await emailInput.evaluate((el) => parseFloat(window.getComputedStyle(el).fontSize));
      expect(fontSize, "font-size du champ e-mail (anti-zoom iOS)").toBeGreaterThanOrEqual(16);
    });

    test("Le bouton de connexion respecte une zone de toucher >= 44px de hauteur", async ({ page }) => {
      await page.goto("/login");
      await page.waitForLoadState("networkidle");

      const loginButton = page.getByRole("button", { name: "Log In" });
      const box = await loginButton.boundingBox();
      expect(box.height, "hauteur du bouton Log In").toBeGreaterThanOrEqual(44);
    });
  });
});
