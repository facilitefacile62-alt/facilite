const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/** Menu ☰ de Locaux : seulement « Réglages » (ni Marketplace, ni Mon activité, ni Établissements ouverts, ni espace vendeur). Rien n'est supprimé du code. */
const menu = fs.readFileSync(path.join(__dirname, "../../mobile/src/app/menu.tsx"), "utf8").replace(/\r\n/g, "\n");

test.describe("menu ☰ de Locaux réduit à Réglages", () => {
  test("la liste de Locaux ne contient que « Réglages » tant que MENU_LOCAUX_REDUIT est vrai", () => {
    expect(menu).toContain("const MENU_LOCAUX_REDUIT = true;");
    expect(menu).toContain("const tuilesLocaux = filtre(MENU_LOCAUX_REDUIT ? [TUILE_REGLAGES, TUILE_MAJ] : [...TUILES_LOCAUX, TUILE_MAJ]);"); // « Réglages » + la tuile « Mise à jour » (grisée sans mise à jour)
    expect(menu).toContain("route: '/marketplace/reglages'");
  });
  test("la carte « Vos espaces » est PLIÉE par défaut (Facilité comme Locaux) et se déplie par le chevron", () => {
    expect(menu).toContain("const [espacesDeplies, setEspacesDeplies] = useState(false);");
    expect(menu).toContain("{espacesDeplies ? (");
    expect(menu).toContain("onPress={() => setEspacesDeplies((v) => !v)}");
  });
  test("l'espace vendeur (Mes annonces, Commandes reçues, Mes livraisons) est masqué, pas supprimé", () => {
    expect(menu).toContain("!MENU_LOCAUX_REDUIT && mode === 'locaux' && boutique");
    for (const reste of ["id: 'marketplace'", "id: 'activite'", "id: 'etablissements'", "id: 'annonces'", "id: 'commandes'", "id: 'livraisons'"]) expect(menu, reste).toContain(reste);
  });
});
