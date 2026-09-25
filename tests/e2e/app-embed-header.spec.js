const { test, expect } = require("@playwright/test");

/**
 * En-tête du site masqué quand une page est ouverte dans la WebView de l'app
 * mobile (double avec l'en-tête natif de l'app — constaté le 25/09/2026 sur
 * tablette). Localhost uniquement, Supabase entièrement simulé.
 *
 * Mécanisme : `?embed_app=1` (ajouté par mobile/src/app/web/[cle].tsx pour une
 * cible publique) déclenche dans src/proxy.js une redirection qui pose le
 * cookie durable `app_embed`, lu ensuite par RootLayout (src/app/layout.js).
 */

test.describe("En-tête masqué dans la WebView de l'app (app_embed)", () => {
  test.setTimeout(120_000);

  test("sans le marqueur : l'en-tête du site est visible normalement", async ({ page }) => {
    await page.goto("/marketplace");
    await expect(page.locator("#main-site-header")).toBeVisible({ timeout: 60_000 });
  });

  test("avec ?embed_app=1 : redirection qui retire le paramètre, en-tête absent, et le reste sans lui à la navigation suivante", async ({
    page,
    context,
  }) => {
    await page.goto("/marketplace?embed_app=1");
    await expect(page).toHaveURL(/\/marketplace$/, { timeout: 60_000 });
    await expect(page.locator("#main-site-header")).toHaveCount(0);
    // la page reste utilisable (pas juste une redirection cassée) : son propre contenu s'affiche
    await expect(page.getByText("Vendez sur Facilité")).toBeVisible({ timeout: 30_000 });

    const cookies = await context.cookies();
    expect(cookies.some((c) => c.name === "app_embed" && c.value === "1")).toBe(true);

    // Cookie durable : une deuxième page, SANS le paramètre, reste sans en-tête.
    await page.goto("/marketplace");
    await expect(page.locator("#main-site-header")).toHaveCount(0);
  });
});
