const { defineConfig, devices } = require("@playwright/test");

/**
 * Config Playwright pour les tests E2E du parcours candidat.
 *
 * Nécessite une vraie base Supabase accessible (via .env.local) et les
 * comptes/données de démonstration créés par supabase/seed.sql — voir
 * tests/e2e/candidate-application.spec.js pour le détail des identifiants
 * attendus (surchargeables via E2E_CANDIDATE_EMAIL/E2E_CANDIDATE_PASSWORD/
 * E2E_RECRUITER_ID).
 */
module.exports = defineConfig({
  // ./tests (pas seulement ./tests/e2e) : couvre aussi tests/security/, les
  // 6 invariants de sécurité (docs/invariants-securite.md) — doivent tourner
  // en CI au même titre que le reste, pas dans un coin isolé qu'on oublie.
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  // "list" reste pour le suivi en direct ; "json" écrit un résultat
  // structuré et complet dans test-results/results.json (gitignored) —
  // avant ça, la sortie de compilation du serveur Next.js (webServer.stdout
  // ci-dessous) noyait le résumé final dans un log illisible, faisant
  // perdre du temps à chaque lecture du résultat d'un run complet.
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],

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
    // "ignore" (stderr est forwardé par défaut par Playwright si non précisé
    // explicitement, contrairement à stdout — asymétrie source de la
    // pollution du log jusqu'ici) : la sortie du serveur Next.js
    // (compilation, warnings de dépréciation, logs applicatifs) n'est plus
    // streamée dans le log de test, quel que soit le résultat du run.
    stdout: "ignore",
    stderr: "ignore",
  },
});
