const { test, expect } = require("@playwright/test");

/**
 * Affiches d'offres : chaque image est montrée à SON format (aucun recadrage
 * fixe, aucune bande sur les côtés). Localhost uniquement ; Supabase ET les
 * images sont entièrement simulés (aucune requête vers une base réelle).
 *
 * Les images passent par un faux hôte *.supabase.co (seul hôte d'images admis par la CSP du site).
 * Les images simulées sont des SVG de formats variés : carré, portrait 2:3,
 * paysage 16:9 et un format extrême (1:4) qui doit être borné à 1:2.
 */

const FORMATS = [
  { cle: "carre", l: 800, h: 800 },
  { cle: "portrait", l: 800, h: 1200 },
  { cle: "paysage", l: 1600, h: 900 },
  { cle: "extreme", l: 400, h: 1600 },
];

function svg(l, h, couleur) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${l}" height="${h}" viewBox="0 0 ${l} ${h}"><rect width="${l}" height="${h}" fill="${couleur}"/><rect x="${l * 0.05}" y="${h * 0.05}" width="${l * 0.9}" height="${h * 0.9}" fill="none" stroke="#fff" stroke-width="${Math.max(l, h) * 0.02}"/></svg>`;
}

const COULEURS = { carre: "#0f766e", portrait: "#7c3aed", paysage: "#b45309", extreme: "#be123c", deux: "#1d4ed8" };

function offre(i, titre, image) {
  return {
    id: `dddddddd-0000-0000-0000-00000000000${i}`,
    title: titre,
    company: `Entreprise ${i}`,
    location: "Dakar",
    contract_type: "CDI",
    description: "Offre de test",
    is_active: true,
    listing_type: "offre_emploi",
    image_url: image,
    created_at: new Date(Date.now() - i * 3_600_000).toISOString(),
    view_count: 0,
  };
}

test.describe("Affiches d'offres : format réel", () => {
  test.setTimeout(240_000);

  test("chaque affiche prend le rapport de son image, sans bandes ni hauteur imposée", async ({ page }) => {
    const offres = [
      ...FORMATS.map((f, i) => offre(i + 1, `Offre ${f.cle}`, `https://faux.supabase.co/storage/v1/object/public/job-offers/${f.cle}.svg`)),
      offre(5, "Offre deux photos", "https://faux.supabase.co/storage/v1/object/public/job-offers/deux-a.svg|||https://faux.supabase.co/storage/v1/object/public/job-offers/paysage.svg"),
    ];

    await page.route("https://faux.supabase.co/**", (route) => {
      const nom = route.request().url().split("/").pop().replace(".svg", "");
      const f = FORMATS.find((x) => x.cle === nom) || { l: 900, h: 900 };
      return route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: svg(f.l, f.h, COULEURS[nom] || COULEURS.deux),
      });
    });
    await page.route("**/rest/v1/**", (route) => {
      const url = route.request().url();
      if (url.includes("/rest/v1/job_offers")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "content-range": `0-${offres.length - 1}/${offres.length}` },
          body: JSON.stringify(offres),
        });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });

    await page.setViewportSize({ width: 430, height: 900 });
    await page.goto("/offres");
    await page.getByText("Offre carre", { exact: false }).first().waitFor({ timeout: 120_000 });

    const mesures = {};
    for (const f of FORMATS) {
      const carte = page.locator("article, div").filter({ hasText: `Offre ${f.cle}` }).filter({ has: page.locator(`img[alt="Offre ${f.cle}"]`) }).last();
      const img = carte.locator(`img[alt="Offre ${f.cle}"]`).first();
      await img.scrollIntoViewIfNeeded();
      // Laisse l'image charger puis le cadre prendre son rapport.
      await expect
        .poll(async () => (await img.evaluate((el) => el.naturalWidth)) > 0, { timeout: 30_000 })
        .toBe(true);
      const cadre = img.locator("xpath=..");
      await page.waitForTimeout(400);
      const box = await cadre.boundingBox();
      mesures[f.cle] = box.width / box.height;
      const objectFit = await img.evaluate((el) => getComputedStyle(el).objectFit);
      expect(objectFit, `${f.cle}: pas de object-contain (bandes)`).not.toBe("contain");
    }

    const attendu = { carre: 1, portrait: 800 / 1200, paysage: 1600 / 900, extreme: 0.5 };
    for (const f of FORMATS) {
      expect(mesures[f.cle], `${f.cle} : rapport du cadre`).toBeGreaterThan(attendu[f.cle] - 0.02);
      expect(mesures[f.cle], `${f.cle} : rapport du cadre`).toBeLessThan(attendu[f.cle] + 0.02);
    }

    // Deux photos : la couverture au format réel + une vignette par autre photo.
    const deux = page.locator(`img[alt="Offre deux photos - Photo 1"]`).first();
    await deux.scrollIntoViewIfNeeded();
    await expect(page.locator(`img[alt="Offre deux photos - Photo 2"]`).first()).toBeVisible();
    await page.screenshot({ path: "test-results/affiches-format-reel.png", fullPage: false });
  });
});
