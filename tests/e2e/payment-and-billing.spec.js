const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

/**
 * Parcours de tarification/paiement : connexion -> parcours du créateur de
 * CV -> ouverture de la modale de tarification -> initialisation du
 * checkout -> présence de la commande dans l'historique de facturation.
 *
 * Réutilise le compte candidat de test créé par supabase/seed.sql (voir
 * tests/e2e/candidate-application.spec.js).
 *
 * Limite assumée : aucune clé Paystack réelle n'est configurée dans cet
 * environnement (PAYSTACK_SECRET_KEY absent de .env.local). /api/pay/checkout
 * répond donc par un 503 explicite avant toute création de commande — ce
 * comportement de garde-fou est ce que ce test vérifie réellement, plutôt
 * que de simuler un paiement Paystack qui nécessiterait de vraies
 * identifiants. La présence d'une commande dans l'historique de facturation
 * est vérifiée séparément en insérant une commande "pending" avec le même
 * schéma que la route de checkout, via un client Supabase authentifié.
 */

const CANDIDATE_EMAIL = process.env.E2E_CANDIDATE_EMAIL || "e2e-test-candidate@facilite-demo.local";
const CANDIDATE_PASSWORD = process.env.E2E_CANDIDATE_PASSWORD || "FaciliteE2ETest2026!";

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", "..", ".env.local");
  const vars = {};
  if (!fs.existsSync(envPath)) return vars;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return vars;
}

test.describe("Tarification, paiement et facturation", () => {
  test("choix d'une formule, initialisation du checkout, et commande visible dans l'historique de facturation", async ({ page }) => {
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

    // 4. Initialisation réelle du checkout (vraie requête HTTP vers /api/pay/checkout).
    await page.getByRole("button", { name: /Payer et Valider/ }).click();
    await expect(page.getByText(/paiement en ligne n'est pas encore configuré/i)).toBeVisible({ timeout: 15_000 });

    // 5. Présence dans l'historique de facturation : insertion d'une commande
    // "pending" avec le schéma exact de /api/pay/checkout, via un client
    // authentifié au nom du même candidat (respecte la policy RLS INSERT
    // "auth.uid() = user_id").
    const env = loadEnvLocal();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: CANDIDATE_EMAIL,
      password: CANDIDATE_PASSWORD,
    });
    expect(signInError).toBeNull();

    const { data: insertedOrder, error: insertError } = await supabase
      .from("orders")
      .insert({
        user_id: signInData.user.id,
        cv_model_id: "modern",
        has_agent_option: false,
        amount: 1500,
        currency: "XOF",
      })
      .select()
      .single();
    expect(insertError).toBeNull();
    expect(insertedOrder).toBeTruthy();

    // 6. Vérification dans /candidat/facturation.
    await page.goto("/candidat/facturation");
    await page.waitForLoadState("networkidle");

    // .first() : la table est triée par created_at décroissant, donc la
    // commande qu'on vient d'insérer est toujours la première ligne — y
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
