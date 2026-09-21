const { test, expect } = require("@playwright/test");

/**
 * Recherche de la barre du header sur la Marketplace — localhost uniquement,
 * Supabase entièrement simulé (aucune requête vers la base réelle, aucune
 * vers ffacilite.com).
 *
 * Régression visée : sur /marketplace déjà ouverte, "Rechercher" / Entrée /
 * clic sur une suggestion faisait router.push("/marketplace?q=…") ; la page
 * ne relisait `q` qu'au montage, la recherche n'était donc jamais appliquée.
 *
 * "Appliquée" = la page a demandé ses articles (limit=60, comme
 * chargerTousLesArticles) avec le filtre titre ilike %q% — à distinguer des
 * suggestions du header, qui utilisent limit=8.
 */

const CHAMP_HEADER = 'input[placeholder*="Rechercher une offre, un article, une boutique"]';

function ligneArticle() {
  return {
    id: "aaaaaaaa-0000-0000-0000-000000000001",
    titre: "Masque hydrogel",
    description: "Masque test",
    categorie: "beaute",
    prix_xof: 2000,
    quantite: 5,
    statut: "en_stock",
    photos: [],
    updated_at: new Date().toISOString(),
    store: {
      id: "bbbbbbbb-0000-0000-0000-000000000002",
      nom: "Boutique Test",
      quartier: "Plateau",
      ville: "Dakar",
      telephone_whatsapp: null,
      latitude: 14.69,
      longitude: -17.44,
      avatar_config: null,
      owner_id: null,
    },
  };
}

async function installerMocks(page, requetes) {
  await page.route("**/rest/v1/**", async (route) => {
    const url = route.request().url();
    requetes.push(url);
    const corps = url.includes("/rest/v1/marketplace_items") ? [ligneArticle()] : [];
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corps) });
  });
}

const pageFiltreePar = (requetes, texte) =>
  requetes.some((u) => {
    if (!u.includes("/rest/v1/marketplace_items") || !u.includes("limit=60")) return false;
    // "+" = espace dans une query string (URLSearchParams de postgrest-js).
    return decodeURIComponent(u.replace(/\+/g, " ")).includes(`titre=ilike.%${texte}%`);
  });

test.describe("Marketplace — recherche du header", () => {
  test.setTimeout(180_000);

  test("depuis la Marketplace déjà ouverte : Entrée applique la recherche", async ({ page }) => {
    const requetes = [];
    await installerMocks(page, requetes);
    await page.goto("/marketplace");
    await expect(page.locator(CHAMP_HEADER)).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(1500);

    await page.locator(CHAMP_HEADER).fill("masque");
    await page.locator(CHAMP_HEADER).press("Enter");

    await expect.poll(() => pageFiltreePar(requetes, "masque"), { timeout: 15_000, message: "page filtrée par titre" }).toBe(true);
    await expect.poll(() => new URL(page.url()).searchParams.get("q"), { timeout: 10_000 }).toBe("masque");
  });

  test("depuis l'onglet vendre : la recherche bascule sur acheter et s'applique", async ({ page }) => {
    const requetes = [];
    await installerMocks(page, requetes);
    await page.goto("/marketplace?onglet=vendre");
    await expect(page.locator(CHAMP_HEADER)).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(1500);

    await page.locator(CHAMP_HEADER).fill("masque");
    await page.locator(CHAMP_HEADER).press("Enter");

    await expect.poll(() => pageFiltreePar(requetes, "masque"), { timeout: 15_000, message: "page filtrée par titre" }).toBe(true);
  });

  test("clic sur une suggestion : la recherche s'applique sur la Marketplace déjà ouverte", async ({ page }) => {
    const requetes = [];
    await installerMocks(page, requetes);
    await page.goto("/marketplace");
    await expect(page.locator(CHAMP_HEADER)).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(1500);

    await page.locator(CHAMP_HEADER).fill("masque");
    // Dans le header (liste de suggestions), pas la carte d'article de la page.
    const suggestion = page.locator("#main-site-header").getByText("Masque hydrogel").first();
    await expect(suggestion).toBeVisible({ timeout: 15_000 });
    await suggestion.click();

    await expect
      .poll(() => pageFiltreePar(requetes, "Masque hydrogel"), { timeout: 15_000, message: "page filtrée par le titre choisi" })
      .toBe(true);
  });

  // Depuis une page EMPLOI (ex. /faq), la barre du header envoie vers
  // /recherche (espace Emploi) : c'est voulu. Le vrai cas "autre page ->
  // Marketplace" est /messagerie?contexte=marketplace, qui exige une
  // connexion et n'est donc pas testable ici : on exerce le même chemin
  // (navigation client vers /marketplace?q=… qui MONTE la page) avec le
  // routeur de Next.
  test("depuis une autre page (navigation client) : la Marketplace s'ouvre déjà filtrée", async ({ page }) => {
    const requetes = [];
    await installerMocks(page, requetes);
    await page.goto("/faq");
    await page.waitForFunction(() => Boolean(window.next && window.next.router), null, { timeout: 90_000 });

    await page.evaluate(() => window.next.router.push("/marketplace?q=masque"));

    await expect(page).toHaveURL(/\/marketplace\?.*q=masque/, { timeout: 60_000 });
    await expect.poll(() => pageFiltreePar(requetes, "masque"), { timeout: 20_000, message: "page filtrée par titre" }).toBe(true);
  });
});
