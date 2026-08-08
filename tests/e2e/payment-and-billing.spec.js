const { test, expect } = require("@playwright/test");

/**
 * Parcours de tarification/paiement : connexion -> parcours du créateur de
 * CV -> ouverture de la modale de tarification -> initialisation réelle du
 * checkout KPay (vraies clés sandbox configurées dans .env.local) ->
 * redirection effective vers la page de paiement hébergée par KPay ->
 * présence de la commande "pending" dans l'historique de facturation.
 *
 * Réutilise le compte candidat de test créé par supabase/seed.sql (voir
 * tests/e2e/candidate-application.spec.js).
 *
 * Le paiement effectif (choix Wave/Orange Money/MTN, saisie du code PIN sur
 * la page KPay) n'est pas simulé ici — il sort du périmètre d'un test
 * automatisé sans numéro de test réel. Ce test s'arrête à la redirection
 * réussie, qui est la seule partie du parcours que /api/pay/checkout
 * contrôle.
 */

const CANDIDATE_EMAIL = process.env.E2E_CANDIDATE_EMAIL || "e2e-test-candidate@facilite-demo.local";
const CANDIDATE_PASSWORD = process.env.E2E_CANDIDATE_PASSWORD || "FaciliteE2ETest2026!";

test.describe("Tarification, paiement et facturation", () => {
  test.skip(!!process.env.TEST_SUPABASE_URL, "SKIP sur projet de test — clés KPay sandbox non configurées sur facilite-e2e-test");

  test("choix d'une formule, redirection réelle vers KPay, et commande visible dans l'historique de facturation", async ({ page }) => {
    // 1. Connexion du candidat de test.
    await page.goto("/login");
    await page.getByPlaceholder("Enter your Email").fill(CANDIDATE_EMAIL);
    await page.getByPlaceholder("Enter your password").fill(CANDIDATE_PASSWORD);
    await page.getByRole("button", { name: "Log In" }).click();
    await page.waitForURL("**/messagerie", { timeout: 20_000 });
    await page.waitForLoadState("networkidle");

    // 2. Parcours du créateur de CV jusqu'à l'étape finale. handleNextStep
    // incrémente l'étape sans validation bloquante — 6 clics suffisent pour
    // atteindre l'étape 6 (aperçu final).
    await page.goto("/creer-cv");
    await page.waitForLoadState("networkidle");
    for (let i = 0; i < 6; i++) {
      await page.getByRole("button", { name: "Continuer" }).click();
    }

    // 3. Ouverture de la modale de tarification (formule "Autonome" sélectionnée par défaut).
    await page.getByRole("button", { name: "Télécharger mon CV (PDF)" }).first().click();
    await expect(page.getByText("Finalisez votre CV")).toBeVisible();
    await expect(page.getByText("Confectionner mon CV moi-même")).toBeVisible();
    await expect(page.getByText("Accompagnement personnalisé par un expert")).toBeVisible();

    // 4. Initialisation réelle du checkout (vraie requête HTTP vers
    // /api/pay/checkout -> vraie requête vers admin.kpay.site en sandbox) et
    // redirection effective vers la page de paiement hébergée par KPay.
    await page.getByRole("button", { name: /Payer et Valider/ }).click();
    await page.waitForURL(/kpay\.site/, { timeout: 20_000 });
    expect(page.url()).toContain("kpay.site");

    // 5. La commande "pending" créée par le checkout apparaît dans
    // l'historique de facturation du candidat.
    await page.goto("/candidat/facturation");
    await page.waitForLoadState("networkidle");

    // .first() : la table est triée par created_at décroissant, donc la
    // commande qu'on vient de créer est toujours la première ligne — y
    // compris lors de ré-exécutions répétées de ce test (non idempotent par
    // conception, comme candidate-application.spec.js qui ne nettoie pas non
    // plus ses données après coup).
    const orderRow = page.locator("tbody tr", { hasText: "Modèle Moderne" }).first();
    await expect(orderRow).toBeVisible();
    await expect(orderRow).toContainText("XOF");
    await expect(orderRow).toContainText("En attente");
    await expect(orderRow).toContainText("Autonome");
  });
});
