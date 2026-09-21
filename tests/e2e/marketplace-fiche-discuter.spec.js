const { test, expect } = require("@playwright/test");

/**
 * Fiche produit du Marketplace : boutons de discussion et de commande —
 * localhost uniquement, Supabase entièrement simulé (aucune requête vers une
 * base réelle ni vers ffacilite.com).
 *
 * Attendus :
 *  - "Commander maintenant" n'existe plus (aucun moyen de paiement pour le moment) ;
 *  - "Discuter sur la plateforme" mène à la messagerie avec le vendeur ET
 *    l'article (titre, id, prix) pour que le vendeur sache quel produit est visé ;
 *  - tant que le vendeur n'est pas connu, pas de lien vers une messagerie vide
 *    (bouton grisé).
 *
 * Le cas "mon propre article" (userId === propriétaire) est couvert par les
 * tests unitaires de etatDiscussionArticle : il exige une session connectée.
 */

const ID_ARTICLE = "aaaaaaaa-0000-0000-0000-000000000001";
const ID_BOUTIQUE = "bbbbbbbb-0000-0000-0000-000000000002";
const ID_VENDEUR = "cccccccc-0000-0000-0000-00000000000c";

function ligneArticle(ownerId) {
  return {
    id: ID_ARTICLE,
    titre: "Gel Exfoliant & Purifiant",
    description: "Article de test",
    categorie: "beaute",
    prix_xof: 5000,
    quantite: 5,
    statut: "en_stock",
    photos: [],
    updated_at: new Date().toISOString(),
    store: {
      id: ID_BOUTIQUE,
      nom: "Boutique Test",
      quartier: "Plateau",
      ville: "Dakar",
      telephone_whatsapp: "+221770000000",
      latitude: 14.69,
      longitude: -17.44,
      avatar_config: null,
      owner_id: ownerId,
    },
  };
}

async function installerMocks(page, ownerId) {
  await page.route("**/rest/v1/**", async (route) => {
    const url = route.request().url();
    const corps = url.includes("/rest/v1/marketplace_items") ? [ligneArticle(ownerId)] : [];
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corps) });
  });
}

test.describe("Marketplace — fiche produit : discuter et commander", () => {
  test.setTimeout(180_000);

  test("vendeur connu : lien de discussion avec l'article, pas de bouton Commander", async ({ page }) => {
    await installerMocks(page, ID_VENDEUR);
    await page.goto(`/marketplace?article=${ID_ARTICLE}`);

    const discuter = page.getByRole("link", { name: /Discuter sur la plateforme/i });
    await expect(discuter).toBeVisible({ timeout: 90_000 });

    const href = await discuter.getAttribute("href");
    const url = new URL(href, "http://localhost:3000");
    expect(url.pathname).toBe("/messagerie");
    expect(url.searchParams.get("recipient")).toBe(ID_VENDEUR);
    expect(url.searchParams.get("contexte")).toBe("marketplace");
    expect(url.searchParams.get("article")).toBe("Gel Exfoliant & Purifiant");
    expect(url.searchParams.get("articleId")).toBe(ID_ARTICLE);
    expect(url.searchParams.get("prix")).toBe("5000");

    await expect(page.getByText("Commander maintenant")).toHaveCount(0);
    await expect(page.getByText(/Discuter sur WhatsApp/i).first()).toBeVisible();
  });

  test("vendeur inconnu : bouton grisé, aucun lien vers une messagerie vide", async ({ page }) => {
    await installerMocks(page, null);
    await page.goto(`/marketplace?article=${ID_ARTICLE}`);

    const bouton = page.getByRole("button", { name: /Discuter sur la plateforme/i });
    await expect(bouton).toBeVisible({ timeout: 90_000 });
    await expect(bouton).toBeDisabled();
    await expect(page.getByRole("link", { name: /Discuter sur la plateforme/i })).toHaveCount(0);
    await expect(page.getByText("Commander maintenant")).toHaveCount(0);
  });
});
