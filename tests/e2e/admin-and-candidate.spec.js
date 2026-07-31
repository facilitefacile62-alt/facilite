const { test, expect } = require("@playwright/test");

/**
 * Back-office admin (analytics + attribution d'une commande à un agent) et
 * suivi candidat (candidatures + gestion des CVs).
 *
 * Comptes de test créés par supabase/seed.sql :
 * - e2e-test-admin@facilite-demo.local (role='admin')
 * - e2e-test-agent@facilite-demo.local (role='agent')
 * - e2e-test-candidate@facilite-demo.local (role='candidat', déjà utilisé par
 *   tests/e2e/candidate-application.spec.js et payment-and-billing.spec.js)
 *
 * seed.sql crée aussi une commande accompagnée "paid" pour ce candidat avec
 * une agent_assignments "unassigned" (id fixe 50000000-0000-4000-a000-
 * 000000000002), remise à "unassigned" à chaque ré-exécution du seed — c'est
 * le dossier que ce test attribue à l'agent de test.
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "e2e-test-admin@facilite-demo.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "FaciliteE2ETest2026!";
const AGENT_FULL_NAME = "Agent E2E Test";
const CANDIDATE_EMAIL = process.env.E2E_CANDIDATE_EMAIL || "e2e-test-candidate@facilite-demo.local";
const CANDIDATE_PASSWORD = process.env.E2E_CANDIDATE_PASSWORD || "FaciliteE2ETest2026!";
const SEEDED_ASSIGNMENT_ID = "50000000-0000-4000-a000-000000000002";

test.describe("Back-office Admin & Suivi Candidat", () => {
  test("admin : analytics + attribution d'une commande à un agent, puis candidat : suivi et gestion des CVs", async ({ page }) => {
    // 1. Connexion admin.
    await page.goto("/login");
    await page.getByPlaceholder("Enter your Email").fill(ADMIN_EMAIL);
    await page.getByPlaceholder("Enter your password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Log In" }).click();
    await page.waitForURL("**/admin", { timeout: 20_000 });
    await page.waitForLoadState("networkidle");

    // 2. Dashboard analytics : KPIs + transaction seedée visible dans la table.
    await page.goto("/admin/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Dashboard Analytics Global")).toBeVisible();
    await expect(page.getByText("Revenu total")).toBeVisible();
    await expect(page.getByText("CVs confectionnés")).toBeVisible();
    await expect(page.getByText("Accompagnements actifs")).toBeVisible();
    await expect(page.getByText("qa-e2e-agent-flow-001")).toBeVisible();

    // 3. Commandes agent : attribution du dossier seedé à l'agent de test.
    await page.goto("/admin/commandes-agent");
    await page.waitForLoadState("networkidle");

    const dossierCard = page.getByTestId(`assignment-${SEEDED_ASSIGNMENT_ID}`);
    await expect(dossierCard).toBeVisible();
    await expect(dossierCard.getByText("Non assigné")).toBeVisible();

    await dossierCard.locator("select").selectOption({ label: AGENT_FULL_NAME });
    await expect(dossierCard.getByText("En cours")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Agent attribué avec succès.")).toBeVisible();

    // 4. Déconnexion admin, connexion candidat.
    await page.getByRole("button", { name: "Déconnexion" }).click();
    await page.waitForURL("**/login", { timeout: 20_000 });

    await page.getByPlaceholder("Enter your Email").fill(CANDIDATE_EMAIL);
    await page.getByPlaceholder("Enter your password").fill(CANDIDATE_PASSWORD);
    await page.getByRole("button", { name: "Log In" }).click();
    await page.waitForURL("**/messagerie", { timeout: 20_000 });
    await page.waitForLoadState("networkidle");

    // 5. Suivi des candidatures.
    await page.goto("/candidat/candidatures");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Suivi de mes Candidatures")).toBeVisible();

    // 6. Mes CVs : la commande accompagnée attribuée à l'étape 3 apparaît
    // avec le statut "En cours" dans la section Accompagnement Expert.
    await page.goto("/candidat/mes-cvs");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Accompagnement Expert")).toBeVisible();
    await expect(page.getByText("Modèle Moderne")).toBeVisible();
    await expect(page.getByText("En cours")).toBeVisible();
  });
});
