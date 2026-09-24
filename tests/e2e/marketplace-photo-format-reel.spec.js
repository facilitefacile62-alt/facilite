const { test, expect } = require("@playwright/test");

/**
 * Fiche produit du Marketplace : la photo principale est montrée à SON format
 * (portrait, paysage…), sans zone carrée imposée ni bandes — localhost
 * uniquement, Supabase et images entièrement simulés.
 *
 * Bornes propres à la fiche : 0,6 (très haute) à 1,8 (très large).
 */

const ID_ARTICLE = "aaaaaaaa-0000-0000-0000-000000000001";

const FORMATS = { portrait: [800, 1200], paysage: [1600, 900], carre: [900, 900], extreme: [300, 1800] };
const COULEURS = { portrait: "#7c3aed", paysage: "#b45309", carre: "#0f766e", extreme: "#be123c" };

function svg(l, h, couleur) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${l}" height="${h}" viewBox="0 0 ${l} ${h}"><rect width="${l}" height="${h}" fill="${couleur}"/><rect x="${l * 0.04}" y="${h * 0.04}" width="${l * 0.92}" height="${h * 0.92}" fill="none" stroke="#fff" stroke-width="${Math.max(l, h) * 0.015}"/></svg>`;
}

function ligneArticle(photos) {
  return {
    id: ID_ARTICLE,
    titre: "Robe test",
    description: "Article de test",
    categorie: "mode",
    prix_xof: 12000,
    quantite: 3,
    statut: "en_stock",
    photos,
    updated_at: new Date().toISOString(),
    store: {
      id: "bbbbbbbb-0000-0000-0000-000000000002",
      nom: "Boutique Test",
      quartier: "Plateau",
      ville: "Dakar",
      telephone_whatsapp: "+221770000000",
      latitude: 14.69,
      longitude: -17.44,
      avatar_config: null,
      owner_id: "cccccccc-0000-0000-0000-00000000000c",
    },
  };
}

async function installerMocks(page, photos) {
  await page.route("**/storage/v1/object/public/marketplace-photos/**", (route) => {
    const nom = route.request().url().split("/").pop().split("?")[0].replace(".svg", "");
    const f = FORMATS[nom] || [900, 900];
    return route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg(f[0], f[1], COULEURS[nom] || "#333") });
  });
  await page.route("**/rest/v1/**", (route) => {
    const url = route.request().url();
    const corps = url.includes("/rest/v1/marketplace_items") ? [ligneArticle(photos)] : [];
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corps) });
  });
}

/** Rapport largeur/hauteur du cadre de la photo principale (parent de l'image). */
async function rapportCadre(page, alt) {
  // .inset-0 : l'image de la fiche (les cartes de la grille, derrière, n'ont pas cette classe)
  const img = page.locator(`img.inset-0[alt="${alt}"]`).first();
  await expect
    .poll(async () => (await img.evaluate((el) => el.naturalWidth)) > 0, { timeout: 30_000 })
    .toBe(true);
  await page.waitForTimeout(500);
  const box = await img.locator("xpath=..").boundingBox();
  return box.width / box.height;
}

test.describe("Marketplace — fiche produit : photo au format réel", () => {
  test.setTimeout(240_000);

  test("portrait, puis paysage en changeant de photo, puis format extrême borné", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await installerMocks(page, ["u/portrait.svg", "u/paysage.svg", "u/extreme.svg"]);
    await page.goto(`/marketplace?article=${ID_ARTICLE}`);

    await page.locator('img.inset-0[alt="Robe test"]').first().waitFor({ timeout: 120_000 });

    // 1re photo : portrait 2:3 (dans les bornes 0,6–1,8 → rapport exact)
    const r1 = await rapportCadre(page, "Robe test");
    expect(r1).toBeGreaterThan(2 / 3 - 0.02);
    expect(r1).toBeLessThan(2 / 3 + 0.02);
    const fit = await page.locator('img.inset-0[alt="Robe test"]').first().evaluate((el) => getComputedStyle(el).objectFit);
    expect(fit).not.toBe("contain");

    // 2e photo : paysage 16:9 (borné à 1,8 : 1,778 reste exact)
    await page.locator("button.shrink-0:has(img)").nth(1).click();
    await expect
      .poll(async () => rapportCadre(page, "Robe test"), { timeout: 20_000 })
      .toBeGreaterThan(1.7);
    const r2 = await rapportCadre(page, "Robe test");
    expect(r2).toBeLessThan(1.85);

    // 3e photo : très haute (1:6) → bornée à 0,6, jamais plus haute
    await page.locator("button.shrink-0:has(img)").nth(2).click();
    await expect
      .poll(async () => rapportCadre(page, "Robe test"), { timeout: 20_000 })
      .toBeLessThan(0.65);
    const r3 = await rapportCadre(page, "Robe test");
    expect(r3).toBeGreaterThan(0.55);

    await page.screenshot({ path: "test-results/marketplace-photo-format-reel.png" });
  });
});
