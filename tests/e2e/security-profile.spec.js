const { test, expect } = require("@playwright/test");

/**
 * Onglet Sécurité du profil : changement de mot de passe et garde-fou de
 * dissociation d'identifiant.
 *
 * Compte dédié (créé par supabase/seed.sql, section 6) : e-mail confirmé,
 * pas de téléphone associé. La confirmation d'un numéro de téléphone et la
 * dissociation avec 2 identifiants ne sont pas couvertes ici : elles
 * dépendent d'une livraison SMS réelle (provider non configuré dans ce
 * dépôt) — voir SecurityTabContent.jsx.
 */

const SECURITY_EMAIL = process.env.E2E_SECURITY_EMAIL || "e2e-test-security@facilite-demo.local";
const SECURITY_PASSWORD = process.env.E2E_SECURITY_PASSWORD || "FaciliteE2ETest2026!";

async function loginAndOpenSecurityTab(page) {
  await page.goto("/login");
  await page.getByPlaceholder("Enter your Email").fill(SECURITY_EMAIL);
  await page.getByPlaceholder("Enter your password").fill(SECURITY_PASSWORD);
  await page.getByRole("button", { name: "Log In" }).click();
  await page.waitForURL(/\/(messagerie|recruteur|profil)/, { timeout: 20_000 });

  await page.goto("/profil?tab=securite");
  await expect(page.getByText("Mes identifiants de connexion")).toBeVisible({ timeout: 15_000 });
}

test.describe("Profil : onglet Sécurité", () => {
  test("l'URL ?tab=securite ouvre directement l'onglet Sécurité", async ({ page }) => {
    await loginAndOpenSecurityTab(page);
    await expect(page.getByText("Changer le mot de passe")).toBeVisible();
  });

  test("la dissociation est bloquée quand l'e-mail est le seul identifiant confirmé", async ({ page }) => {
    await loginAndOpenSecurityTab(page);

    await page.getByRole("button", { name: "Dissocier" }).click();
    await expect(page.getByText(/au moins un moyen de connexion vérifié/i)).toBeVisible({ timeout: 10_000 });
    // La modale de confirmation ne doit jamais s'ouvrir : le garde-fou agit avant.
    await expect(page.getByText(/Dissocier votre/i)).not.toBeVisible();
  });

  test("changement de mot de passe : ancien mot de passe incorrect rejeté, correct accepté", async ({ page }) => {
    await loginAndOpenSecurityTab(page);

    // Ancien mot de passe incorrect -> erreur, pas de mise à jour.
    await page.getByPlaceholder("Requis pour confirmer que c'est bien vous").fill("MotDePasseIncorrect123!");
    await page.getByPlaceholder("Min. 6 caractères").fill("NouveauTemp2026!");
    await page.getByPlaceholder("Confirmez").fill("NouveauTemp2026!");
    await page.getByRole("button", { name: "Mettre à jour le mot de passe" }).click();
    await expect(page.getByText(/mot de passe actuel incorrect/i)).toBeVisible({ timeout: 10_000 });

    // Ancien mot de passe correct -> succès, puis remet l'original pour que
    // le test reste rejouable (compte partagé entre les runs E2E).
    await page.getByPlaceholder("Requis pour confirmer que c'est bien vous").fill(SECURITY_PASSWORD);
    await page.getByPlaceholder("Min. 6 caractères").fill("NouveauTemp2026!");
    await page.getByPlaceholder("Confirmez").fill("NouveauTemp2026!");
    await page.getByRole("button", { name: "Mettre à jour le mot de passe" }).click();
    await expect(page.getByText(/mis à jour avec succès/i)).toBeVisible({ timeout: 10_000 });

    await page.getByPlaceholder("Requis pour confirmer que c'est bien vous").fill("NouveauTemp2026!");
    await page.getByPlaceholder("Min. 6 caractères").fill(SECURITY_PASSWORD);
    await page.getByPlaceholder("Confirmez").fill(SECURITY_PASSWORD);
    await page.getByRole("button", { name: "Mettre à jour le mot de passe" }).click();
    await expect(page.getByText(/mis à jour avec succès/i)).toBeVisible({ timeout: 10_000 });
  });
});
