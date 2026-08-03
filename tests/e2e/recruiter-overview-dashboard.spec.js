const { test, expect } = require("@playwright/test");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const { runPrivilegedSql } = require("../helpers/privilegedSql");

function loadEnvLocal() {
  const envPath = path.resolve(__dirname, "../../.env.local");
  const content = fs.readFileSync(envPath, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

/**
 * Étape F du chantier (2026-08-03) — onglet "Vue d'ensemble" du tableau de
 * bord recruteur (KPI + entonnoir), vérifié en conditions réelles avec le
 * compte démo (supabase/scripts/generate-demo-data.sql) : c'est le seul
 * compte dont le volume de données rend le test visuellement significatif.
 */

const DEMO_EMAIL = "demo.investisseur@facilite-demo.local";
const DEMO_PASSWORD = "CompteDemoNonUtilisable2026!";

async function loginAsDemo(page) {
  await page.goto("/login");
  await page.getByPlaceholder("Enter your Email").fill(DEMO_EMAIL);
  await page.getByPlaceholder("Enter your password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Log In" }).click();
  // Un compte badgé verified_recruiter est redirigé directement vers
  // /recruteur après connexion (src/app/login/page.js) — pas /messagerie.
  await page.waitForURL("**/recruteur", { timeout: 20_000 });
}

test.describe("Tableau de bord recruteur — Vue d'ensemble (KPI + entonnoir)", () => {
  test("affiche les KPI, le graphique 30 jours, l'entonnoir et les dernières candidatures", async ({ page }) => {
    await loginAsDemo(page);
    await page.goto("/recruteur");
    await page.waitForLoadState("networkidle");

    // Onglet "Vue d'ensemble" par défaut — pas besoin de cliquer.
    await expect(page.getByText("Offres actives")).toBeVisible();
    await expect(page.getByText("Candidatures (7j)")).toBeVisible();
    await expect(page.getByText("Taux de conversion")).toBeVisible();

    await expect(page.getByText("Candidatures reçues — 30 derniers jours")).toBeVisible();
    await expect(page.getByText("Entonnoir de recrutement")).toBeVisible();
    // Une des offres démo doit apparaître dans l'entonnoir.
    await expect(page.getByText("Développeur Full-Stack")).toBeVisible();

    await expect(page.getByText("Dernières candidatures")).toBeVisible();
  });

  test("état vide géré proprement pour un compte sans offre active", async ({ page }) => {
    // e2e-test-security, badgé mais sans offre à ce stade des tests, doit
    // voir un état vide explicite plutôt qu'un tableau de bord cassé —
    // vérifié en isolation, sans dépendre de l'état laissé par d'autres
    // fichiers (badge accordé/révoqué localement à ce test).
    const env = loadEnvLocal();
    const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data } = await client.auth.signInWithPassword({ email: "e2e-test-security@facilite-demo.local", password: "FaciliteE2ETest2026!" });
    const securityId = data.user.id;
    await runPrivilegedSql(`UPDATE public.profiles SET badges = badges || '["verified_recruiter"]'::jsonb WHERE id = '${securityId}' AND NOT (badges @> '["verified_recruiter"]'::jsonb);`);

    try {
      await page.goto("/login");
      await page.getByPlaceholder("Enter your Email").fill("e2e-test-security@facilite-demo.local");
      await page.getByPlaceholder("Enter your password").fill("FaciliteE2ETest2026!");
      await page.getByRole("button", { name: "Log In" }).click();
      await page.waitForURL("**/recruteur", { timeout: 20_000 });
      await page.waitForLoadState("networkidle");
      await expect(page.getByText("Aucune statistique pour le moment")).toBeVisible();
    } finally {
      await runPrivilegedSql(`UPDATE public.profiles SET badges = badges - 'verified_recruiter' WHERE id = '${securityId}';`);
    }
  });
});
