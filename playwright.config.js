import { defineConfig, devices } from "@playwright/test";

/**
 * Config Playwright pour les tests E2E du parcours candidat.
 *
 * Nécessite une vraie base Supabase accessible (via .env.local) et les
 * comptes/données de démonstration créés par supabase/seed.sql — voir
 * tests/e2e/candidate-application.spec.js pour le détail des identifiants
 * attendus (surchargeables via E2E_CANDIDATE_EMAIL/E2E_CANDIDATE_PASSWORD/
 * E2E_RECRUITER_ID).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],

  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Démarre le serveur Next.js de dev automatiquement si aucun n'écoute déjà
  // sur le port (utile en CI/local) ; réutilise un serveur déjà lancé sinon.
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
