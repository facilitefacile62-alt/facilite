const { test, expect } = require("@playwright/test");

/**
 * Mini carte de la Marketplace (« Autour de moi » > Mini carte) : mise en page —
 * localhost uniquement, Supabase entièrement simulé.
 *
 * Défauts signalés (captures du 24/09/2026) :
 *  1. la barre flottante du bas (carrousel) était trop haute et débordait ;
 *  2. la bascule « Boutiques | Articles » était décentrée et coupée en bas ;
 *  3. la bulle des produits dépassait du bord supérieur de la carte.
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

async function installerMocks(page) {
  await page.route("**/rest/v1/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/rpc/rechercher_articles_proches")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(articlesSimules()) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

async function ouvrirMiniCarte(page) {
  await page.goto("/marketplace");
  await page.getByRole("button", { name: /Autour de moi/ }).first().click({ timeout: 90_000 });
  await page.getByRole("menuitem", { name: /Mini carte/ }).click();
  await expect(page.locator(".leaflet-container").first()).toBeVisible({ timeout: 60_000 });
  // laisse les marqueurs et le dock se poser
  await page.waitForTimeout(2500);
}

/** Cadre de la mini carte : la zone `relative … overflow-hidden` qui contient la carte ET le dock du bas. */
function cadre(page) {
  return page.locator(".leaflet-container").first().locator("xpath=ancestor::div[contains(@class,'overflow-hidden')][1]");
}

test.describe("Mini carte — mise en page", () => {
  test.use({ geolocation: POSITION, permissions: ["geolocation"] });
  test.setTimeout(240_000);

  for (const [nom, largeur] of [["téléphone", 390], ["ordinateur", 1280]]) {
    test(`${nom} : dock compact, bascule Boutiques/Articles centrée et entière`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 900 });
      await installerMocks(page);
      await ouvrirMiniCarte(page);

      const c = await cadre(page).boundingBox();
      const boutiques = page.getByRole("button", { name: "Boutiques", exact: true }).first();
      const articles = page.getByRole("button", { name: "Articles", exact: true }).first();
      await expect(boutiques).toBeVisible();
      const b = await boutiques.boundingBox();
      const a = await articles.boundingBox();

      // bascule : entièrement dans le cadre, centrée horizontalement (±4 px), dans le bas de la carte
      expect(b.y + b.height, "bascule non coupée en bas").toBeLessThanOrEqual(c.y + c.height + 0.5);
      const centreBascule = (b.x + a.x + a.width) / 2;
      expect(Math.abs(centreBascule - (c.x + c.width / 2)), "bascule centrée").toBeLessThanOrEqual(4);
      expect(b.y, "bascule dans la moitié basse").toBeGreaterThan(c.y + c.height / 2);

      // carrousel : au-dessus de la bascule, sans la chevaucher, et bas (avatars + libellé + marges)
      const flecheSuivante = page.getByRole("button", { name: /suivante/ }).first();
      const f = await flecheSuivante.boundingBox();
      expect(f.y + f.height, "carrousel au-dessus de la bascule").toBeLessThanOrEqual(b.y + 1);
      expect(f.x + f.width, "flèche dans le cadre").toBeLessThanOrEqual(c.x + c.width);
      expect(f.x, "flèche dans le cadre").toBeGreaterThanOrEqual(c.x);
      // le dock (du haut du carrousel au bas de la bascule) ne prend pas plus de 40 % du cadre
      const hautDock = Math.min(f.y, b.y);
      expect(c.y + c.height - hautDock, "hauteur du dock").toBeLessThanOrEqual(c.height * 0.4);

      await page.screenshot({ path: `test-results/mini-carte-${largeur}.png`, clip: { x: c.x, y: c.y, width: c.width, height: c.height } });
    });

    test(`${nom} : la bulle des produits reste entière dans la carte`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 900 });
      await installerMocks(page);
      await ouvrirMiniCarte(page);

      // avatars (.leaflet-marker-icon) ET pastilles bleues (cercles SVG interactifs) : les deux ouvrent la bulle au survol
      const marqueurs = page.locator(".leaflet-marker-icon, path.leaflet-interactive");
      const n = await marqueurs.count();
      expect(n).toBeGreaterThan(0);

      const carte = await page.locator(".leaflet-container").first().boundingBox();
      let bullesVues = 0;
      for (let i = 0; i < n; i++) {
        const m = marqueurs.nth(i);
        const boite = await m.boundingBox();
        // marqueur visible dans la carte seulement (les autres sortent du cadre)
        if (!boite || boite.x < carte.x || boite.x + boite.width > carte.x + carte.width || boite.y < carte.y || boite.y + boite.height > carte.y + carte.height) continue;
        await m.hover({ force: true });
        const bulle = page.locator(".carte-bulle-produits-popup .bulle-produits-container").first();
        if (!(await bulle.isVisible().catch(() => false))) {
          await page.waitForTimeout(400);
          if (!(await bulle.isVisible().catch(() => false))) continue;
        }
        const p = await bulle.boundingBox();
        bullesVues += 1;
        expect(p.y, `bulle ${i} : bord supérieur`).toBeGreaterThanOrEqual(carte.y - 1);
        expect(p.x, `bulle ${i} : bord gauche`).toBeGreaterThanOrEqual(carte.x - 1);
        expect(p.x + p.width, `bulle ${i} : bord droit`).toBeLessThanOrEqual(carte.x + carte.width + 1);
        expect(p.width, `bulle ${i} : largeur`).toBeLessThanOrEqual(241);
        // ni sous la barre d'outils du haut, ni sous le dock du bas (carrousel + bascule)
        expect(p.y, `bulle ${i} : sous la barre du haut`).toBeGreaterThanOrEqual(carte.y + 46);
        const dock = await page.locator("[data-dock-carte]").first().boundingBox();
        expect(p.y + p.height, `bulle ${i} : au-dessus du dock`).toBeLessThanOrEqual(dock.y + 1);
        await page.screenshot({ path: `test-results/mini-carte-bulle-${largeur}-${i}.png`, clip: { x: carte.x, y: carte.y, width: carte.width, height: carte.height } });
        await page.mouse.move(carte.x + 2, carte.y + carte.height - 2);
        await page.waitForTimeout(500);
      }
      expect(bullesVues, "au moins une bulle a pu être ouverte").toBeGreaterThan(0);
    });
  }
});
