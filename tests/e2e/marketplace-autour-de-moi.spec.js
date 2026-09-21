const { test, expect } = require("@playwright/test");

/**
 * "Autour de moi" (Marketplace) — localhost uniquement, Supabase entièrement
 * simulé (aucune requête vers la base réelle, aucune vers ffacilite.com).
 *
 * Couvre : une seule recherche de proximité par clic, carte Leaflet non
 * recréée quand de nouveaux résultats arrivent, aucune erreur Leaflet
 * (_leaflet_pos) quand des résultats arrivent pendant une animation de
 * zoom, et bouton du header fonctionnel depuis l'onglet "vendre".
 */

const POSITION = { latitude: 14.6928, longitude: -17.4467 };

function articlesSimules() {
  return Array.from({ length: 4 }).map((_, i) => ({
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

async function installerMocks(page, compteurs) {
  await page.route("**/rest/v1/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/rpc/rechercher_articles_proches")) {
      compteurs.articles += 1;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(articlesSimules()) });
    }
    if (url.includes("/rpc/rechercher_boutiques_proches")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

const boutonAutourDeMoi = (page) => page.getByRole("button", { name: /Autour de moi/ }).first();

test.describe("Marketplace — Autour de moi", () => {
  test.use({ geolocation: POSITION, permissions: ["geolocation"] });
  test.setTimeout(180_000);

  test("un clic = une seule recherche de proximité, carte non recréée", async ({ page }) => {
    const compteurs = { articles: 0 };
    const erreurs = [];
    page.on("pageerror", (e) => erreurs.push(e.message));
    await installerMocks(page, compteurs);

    await page.goto("/marketplace");
    await boutonAutourDeMoi(page).click({ timeout: 90_000 });

    const carte = page.locator(".leaflet-container").first();
    await expect(carte).toBeVisible({ timeout: 30_000 });
    const idInitial = await carte.evaluate((el) => el._leaflet_id);
    await page.waitForTimeout(3000);

    expect(compteurs.articles, "recherches de proximité pour UN clic").toBe(1);
    expect(await carte.evaluate((el) => el._leaflet_id), "carte Leaflet recréée").toBe(idInitial);
    expect(erreurs.filter((m) => m.includes("_leaflet_pos"))).toEqual([]);
  });

  test("nouveaux résultats pendant un zoom animé : pas d'erreur Leaflet, carte conservée", async ({ page }) => {
    const compteurs = { articles: 0 };
    const erreurs = [];
    page.on("pageerror", (e) => erreurs.push(e.message));
    await installerMocks(page, compteurs);

    await page.goto("/marketplace");
    await boutonAutourDeMoi(page).click({ timeout: 90_000 });
    const carte = page.locator(".leaflet-container").first();
    await expect(carte).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(2500);
    const idInitial = await carte.evaluate((el) => el._leaflet_id);

    // Zoom animé (molette) puis nouvelle recherche immédiatement, comme un
    // utilisateur qui zoome puis rappuie sur "Autour de moi".
    const boite = await carte.boundingBox();
    await page.mouse.move(boite.x + boite.width / 2, boite.y + boite.height / 2);
    await page.mouse.wheel(0, -400);
    await boutonAutourDeMoi(page).click();
    await page.waitForTimeout(3500);

    expect(erreurs.filter((m) => m.includes("_leaflet_pos")), "erreur Leaflet _leaflet_pos").toEqual([]);
    expect(await carte.evaluate((el) => el._leaflet_id), "carte Leaflet recréée").toBe(idInitial);
  });

  test("le bouton du header fonctionne aussi depuis l'onglet vendre", async ({ page }) => {
    const compteurs = { articles: 0 };
    await installerMocks(page, compteurs);

    await page.goto("/marketplace?onglet=vendre");
    await boutonAutourDeMoi(page).click({ timeout: 90_000 });

    await expect(page.locator(".leaflet-container").first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    expect(compteurs.articles).toBe(1);
  });
});
