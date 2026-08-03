const { test, expect } = require("@playwright/test");

test.describe("Parcours E2E Récupération de Mot de Passe", () => {
  test("Accès et soumission du formulaire de réinitialisation de mot de passe", async ({ page }) => {
    // 1. Accès à la page de connexion
    await page.goto("http://localhost:3000/login");

    // 2. Navigation vers la réinitialisation de mot de passe
    const forgotPasswordLink = page.locator("a[href='/forgot-password']");
    await expect(forgotPasswordLink).toBeVisible();
    await forgotPasswordLink.click();

    await page.waitForURL("**/forgot-password");
    await expect(page.locator("h1")).toContainText("Reset Password");

    // 3. Soumission du formulaire avec un e-mail valide
    const emailInput = page.locator("input[type='email']");
    await expect(emailInput).toBeVisible();
    await emailInput.fill("test-reset@facilite-demo.local");

    const submitBtn = page.locator("button[type='submit']");
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // 4. Vérification du message de succès d'envoi
    const successMsg = page.locator("h2");
    await expect(successMsg).toContainText("E-mail envoyé !");
  });
});
