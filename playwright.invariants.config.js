const { defineConfig } = require("@playwright/test");

/**
 * Config Playwright DÉDIÉE aux 13 invariants de sécurité (tests/security/invariants.spec.js).
 *
 * Pourquoi une config à part : playwright.config.js exige TEST_SUPABASE_URL (garde-fou des tests e2e, qui écrivent dans le projet de TEST).
 * Les invariants, eux, n'utilisent ni navigateur ni projet de TEST : ils lisent le dépôt sur disque et interrogent la PRODUCTION en
 * introspection (--db-url $SUPABASE_DB_URL en CI, --linked en local), voir tests/helpers/privilegedSql.js. Sans cette config, le job CI
 * « Invariants de sécurité » s'arrêtait à « REFUS : TEST_SUPABASE_URL manquante » avant d'avoir vérifié quoi que ce soit.
 */
module.exports = defineConfig({
  testDir: "./tests/security",
  testMatch: "invariants.spec.js",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  projects: [{ name: "chromium" }],
});
