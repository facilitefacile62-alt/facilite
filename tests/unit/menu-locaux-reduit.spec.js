const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/** Menu ☰ de Locaux : seulement « Réglages » (ni Marketplace, ni Mon activité, ni Établissements ouverts, ni espace vendeur). Rien n'est supprimé du code. */
const menu = fs.readFileSync(path.join(__dirname, "../../mobile/src/app/menu.tsx"), "utf8").replace(/\r\n/g, "\n");

test.describe("menu ☰ de Locaux réduit à Réglages", () => {
  test("la liste de Locaux ne contient que « Réglages » tant que MENU_LOCAUX_REDUIT est vrai", () => {
    expect(menu).toContain("const MENU_LOCAUX_REDUIT = true;");
    expect(menu).toContain("const tuilesLocaux = filtre(MENU_LOCAUX_REDUIT ? [TUILE_REGLAGES] : TUILES_LOCAUX);");
    expect(menu).toContain("route: '/marketplace/reglages'");
  });
  test("la carte « Vos espaces » (Locaux / nom du compte, Profil, Boutique) n'est plus affichée dans le menu de Locaux ; celle de Facilité reste", () => {
    expect(menu).toContain("{espacesDeplies && !(MENU_LOCAUX_REDUIT && page === 1) ? (");
  });
  test("l'espace vendeur (Mes annonces, Commandes reçues, Mes livraisons) est masqué, pas supprimé", () => {
    expect(menu).toContain("!MENU_LOCAUX_REDUIT && mode === 'locaux' && boutique");
    for (const reste of ["id: 'marketplace'", "id: 'activite'", "id: 'etablissements'", "id: 'annonces'", "id: 'commandes'", "id: 'livraisons'"]) expect(menu, reste).toContain(reste);
  });
});
