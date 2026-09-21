const { test, expect } = require("@playwright/test");

/**
 * Défilement horizontal des docks de boutiques/articles (carte compacte
 * "Autour de moi" et Explorer) — localhost uniquement, Supabase simulé.
 *
 * Hypothèse NON REPRODUITE côté utilisateur ("la flèche efface le texte et
 * revient en arrière") : aucun `overscroll-behavior` sur ces défileurs, donc
 * un balayage horizontal arrivé en bout de dock est transmis au navigateur,
 * qui le lit comme "Précédent" (page rechargée, texte non validé perdu). Ce
 * fichier ne prouve PAS que c'est la cause : il vérifie que le correctif est
 * en place (style calculé) et que le dock défile lui-même, pas la page.
 */

const POSITION = { latitude: 14.6928, longitude: -17.4467 };

function articlesSimules() {
  return Array.from({ length: 8 }).map((_, i) => ({
    id: `aaaaaaaa-0000-0000-0000-00000000000${i}`,
    titre: `Article ${i}`,
    prix_xof: 1000 * (i + 1),
    photos: [],
    boutique_id: `bbbbbbbb-0000-0000-0000-00000000000${i}`,
    boutique_nom: `Boutique ${i}`,
    boutique_lat: POSITION.latitude + i * 0.004,
    boutique_lng: POSITION.longitude + i * 0.004,
    quartier: "Plateau",
    ville: "Dakar",
    telephone_whatsapp: null,
    whatsapp: null,
    statut: "en_stock",
    distance_km: i * 0.5,
    boutique_avatar_config: null,
    boutique_owner_id: null,
  }));
}

async function installerMocks(page) {
  await page.route("**/rest/v1/**", async (route) => {
    const url = route.request().url();
    const corps = url.includes("/rpc/rechercher_articles_proches") ? articlesSimules() : [];
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corps) });
  });
}

const overscrollX = (locator) => locator.evaluate((el) => getComputedStyle(el).overscrollBehaviorX);

test.describe("Docks — défilement horizontal", () => {
  test.use({ geolocation: POSITION, permissions: ["geolocation"] });
  test.setTimeout(180_000);

  test("carte compacte : le dock ne transmet pas le balayage horizontal au navigateur", async ({ page }) => {
    await installerMocks(page);
    await page.goto("/marketplace");
    await page.getByRole("button", { name: /Autour de moi/ }).first().click({ timeout: 90_000 });
    const avatar = page.locator("[data-boutique-id]").first();
    await expect(avatar).toBeVisible({ timeout: 30_000 });

    expect(await overscrollX(avatar.locator("xpath=.."))).toBe("contain");
  });

  test("Explorer : les 3 défileurs horizontaux (pastilles, boutiques, articles)", async ({ page }) => {
    await installerMocks(page);
    await page.goto(`/marketplace?lat=${POSITION.latitude}&lng=${POSITION.longitude}&explorer=1`);
    const explorer = page.locator('[role="dialog"][aria-label*="Snap Map"]');
    await expect(explorer).toBeVisible({ timeout: 90_000 });

    const pastilles = explorer.getByRole("button", { name: /Toutes les boutiques/ }).first().locator("xpath=..");
    expect(await overscrollX(pastilles), "rangée de pastilles").toBe("contain");

    const dockBoutiques = explorer.locator("[data-boutique-id]").first();
    await expect(dockBoutiques).toBeVisible({ timeout: 30_000 });
    expect(await overscrollX(dockBoutiques.locator("xpath=..")), "dock des boutiques").toBe("contain");

    await explorer.getByRole("button", { name: "Articles", exact: true }).click();
    const dockArticles = explorer.locator("[data-article-id]").first();
    await expect(dockArticles).toBeVisible({ timeout: 30_000 });
    expect(await overscrollX(dockArticles.locator("xpath=..")), "dock des articles").toBe("contain");
  });
});

test.describe("Docks — le dock défile, pas la page", () => {
  test.use({ geolocation: POSITION, permissions: ["geolocation"], viewport: { width: 1280, height: 230 } });
  test.setTimeout(180_000);

  test("flèches du dock : la page ne défile pas, le dock oui", async ({ page }) => {
    await installerMocks(page);
    await page.goto("/marketplace");
    await page.getByRole("button", { name: /Autour de moi/ }).first().click({ timeout: 90_000 });
    const suivant = page.getByLabel("Boutique suivante");
    await expect(suivant).toBeAttached({ timeout: 30_000 });
    await page.waitForTimeout(2000);

    const dock = page.locator("[data-boutique-id]").first().locator("xpath=..");
    const yAvant = await page.evaluate(() => window.scrollY);
    // Clic par el.click() : Playwright ne doit pas, lui, faire défiler la page.
    for (let i = 0; i < 6; i++) {
      await suivant.evaluate((el) => el.click());
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(1200);

    expect(await page.evaluate(() => window.scrollY), "défilement de la page").toBe(yAvant);
    expect(await dock.evaluate((el) => el.scrollLeft), "défilement horizontal du dock").toBeGreaterThan(0);
  });
});
