const { test, expect } = require("@playwright/test");

/**
 * Menu déroulant « Autour de moi » (barre de navigation Marketplace) —
 * localhost uniquement, Supabase entièrement simulé.
 *
 *  - Articles proches : la grille des articles de la zone, SANS carte ;
 *  - Mini carte       : la carte compacte au-dessus des catégories ;
 *  - Pleine carte     : l'explorateur de carte en grand écran.
 * Le menu se ferme au clic à l'extérieur, à Échap et au choix d'une option.
 */

const POSITION = { latitude: 14.6928, longitude: -17.4467 };

function articlesSimules() {
  return Array.from({ length: 4 }).map((_, i) => ({
    id: `aaaaaaaa-0000-0000-0000-00000000000${i}`,
    titre: `Article proche ${i}`,
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

async function installerMocks(page, compteurs) {
  await page.route("**/rest/v1/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/rpc/rechercher_articles_proches")) {
      compteurs.articles += 1;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(articlesSimules()) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

const bouton = (page) => page.getByRole("button", { name: /Autour de moi/ }).first();
const menu = (page) => page.getByRole("menu", { name: "Autour de moi" });
const option = (page, nom) => page.getByRole("menuitem", { name: nom });
const carteCompacte = (page) => page.locator(".leaflet-container").first();
const pleineCarte = (page) => page.getByRole("dialog", { name: /Snap Map/ });

test.describe("Marketplace — menu Autour de moi", () => {
  test.use({ geolocation: POSITION, permissions: ["geolocation"] });
  test.setTimeout(240_000);

  test("le bouton ouvre un menu à trois choix ; clic à l'extérieur et Échap le referment", async ({ page }) => {
    await installerMocks(page, { articles: 0 });
    await page.goto("/marketplace");
    await bouton(page).click({ timeout: 90_000 });

    await expect(menu(page)).toBeVisible();
    await expect(option(page, /Articles proches/)).toBeVisible();
    await expect(option(page, /Mini carte/)).toBeVisible();
    await expect(option(page, /Pleine carte/)).toBeVisible();

    // clic à l'extérieur
    await page.mouse.click(5, 5);
    await expect(menu(page)).toHaveCount(0, { timeout: 5_000 });

    // Échap
    await bouton(page).click();
    await expect(menu(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu(page)).toHaveCount(0, { timeout: 5_000 });
  });

  test("Articles proches : les articles de la zone, sans carte ; l'adresse garde le choix", async ({ page }) => {
    await installerMocks(page, { articles: 0 });
    await page.goto("/marketplace");
    await bouton(page).click({ timeout: 90_000 });
    await option(page, /Articles proches/).click();

    await expect(menu(page)).toHaveCount(0, { timeout: 5_000 });
    await expect(page.getByText("Article proche 0").first()).toBeVisible({ timeout: 30_000 });
    await expect(carteCompacte(page)).toHaveCount(0);
    await expect(pleineCarte(page)).toHaveCount(0);
    await expect(page).toHaveURL(/vue=liste/);
  });

  test("Mini carte : la carte compacte s'affiche ; depuis Articles proches, sans nouvelle recherche", async ({ page }) => {
    const compteurs = { articles: 0 };
    await installerMocks(page, compteurs);
    await page.goto("/marketplace");
    await bouton(page).click({ timeout: 90_000 });
    await option(page, /Articles proches/).click();
    await expect(page.getByText("Article proche 0").first()).toBeVisible({ timeout: 30_000 });
    await expect(carteCompacte(page)).toHaveCount(0);
    const avant = compteurs.articles;

    await bouton(page).click();
    await option(page, /Mini carte/).click();
    await expect(carteCompacte(page)).toBeVisible({ timeout: 30_000 });
    expect(compteurs.articles, "position déjà connue : pas de nouvelle recherche").toBe(avant);
    await expect(page).not.toHaveURL(/vue=liste/);
  });

  test("Pleine carte : l'explorateur s'ouvre en grand écran, et se ferme", async ({ page }) => {
    await installerMocks(page, { articles: 0 });
    await page.goto("/marketplace");
    await bouton(page).click({ timeout: 90_000 });
    await option(page, /Pleine carte/).click();

    await expect(pleineCarte(page)).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Fermer la carte" }).click();
    await expect(pleineCarte(page)).toHaveCount(0, { timeout: 10_000 });
  });
});
