const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Application : « Signaler cette annonce » (même fonction SQL et mêmes motifs que le site) ; plus d'invitation « À confirmer » pour le WhatsApp de la boutique
 * (décision du propriétaire : aucune confirmation de numéro n'est exigée pour vendre ou publier).
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");

test.describe("signaler une annonce dans l'application", () => {
  test("mêmes motifs que le site et que la contrainte de la base", () => {
    const app = lire("mobile/src/lib/signalement.ts");
    const site = lire("src/lib/marketplaceData.js");
    const base = lire("supabase/migrations/20260902120000_marketplace_signalements.sql");
    const idsApp = [...app.matchAll(/\{ id: '([a-z_]+)', libelle: /g)].map((m) => m[1]);
    const idsSite = [...site.slice(site.indexOf("MOTIFS_SIGNALEMENT")).matchAll(/\{ id: "([a-z_]+)", label:/g)].map((m) => m[1]).slice(0, 5);
    expect(idsApp).toEqual(["inexistant", "prix_trompeur", "contrefacon", "interdit", "autre"]);
    expect(idsApp).toEqual(idsSite);
    for (const id of idsApp) expect(base).toContain(`'${id}'`);
  });
  test("appelle la fonction existante signaler_annonce avec les mêmes paramètres que le site, sans écrire dans une table", () => {
    const app = lire("mobile/src/lib/signalement.ts");
    expect(app).toContain("supabase.rpc('signaler_annonce'");
    for (const p of ["p_item_id", "p_motif", "p_details"]) expect(app).toContain(p);
    expect(app).not.toMatch(/\.from\(\s*['"]marketplace_reports['"]\s*\)/);
  });
  test("le bouton est sur la fiche de l'annonce, jamais sur sa propre annonce, avec connexion requise", () => {
    const fiche = lire("mobile/src/app/marketplace/[id].tsx");
    expect(fiche).toContain("Signaler cette annonce");
    expect(fiche).toMatch(/\{!estMonArticle \? \(\s*<Pressable onPress=\{signaler\}/);
    expect(fiche).toMatch(/function signaler\(\) \{\s*if \(!user\?\.id\) \{\s*router\.push\('\/login'\);/);
  });
});

test.describe("WhatsApp de la boutique : plus d'invitation à confirmer", () => {
  const coord = lire("mobile/src/components/EcranCoordonnees.tsx");
  test("plus de pastille « À confirmer » ni de code WhatsApp dans Coordonnées", () => {
    expect(coord).not.toContain("whatsapp-code");
    expect(coord).not.toContain("confirmer_whatsapp_boutique");
    expect(coord).not.toMatch(/Recevoir un code sur WhatsApp|Confirmez ce numéro WhatsApp/);
    // la carte WhatsApp existe toujours, sans pastille de confirmation
    const debut = coord.indexOf('titre="WhatsApp"');
    const carte = coord.slice(debut, coord.indexOf("onPress", debut));
    expect(carte).not.toContain("Pastille");
  });
});
