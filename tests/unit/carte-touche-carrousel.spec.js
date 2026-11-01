const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Touche « Carrousel » DANS la carte, juste après « Autour de moi » : un toucher ouvre et FIXE la bulle (nom, quartier, carrousel d'articles) de TOUTES les boutiques
 * affichées ; un second toucher les ferme. Les boutiques proches sont écartées (jamais empilées) et « Vous êtes ici » n'y participe pas.
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");
const g = () => lire("src/components/GlobeExplorateurBoutiques.jsx");

test("touche « Carrousel » dans la rangée de la carte, juste après « Autour de moi » et avant « Trouver un livreur »", () => {
  const c = g();
  const iAutour = c.indexOf("<span>Autour de moi</span>");
  const iCarrousel = c.indexOf("<span>Carrousel</span>");
  const iLivreur = c.indexOf("<span>Trouver un livreur</span>");
  expect(iAutour).toBeGreaterThan(0);
  expect(iCarrousel).toBeGreaterThan(iAutour);
  expect(iLivreur).toBeGreaterThan(iCarrousel);
  const entre = c.slice(c.indexOf("</button>", iAutour), c.indexOf("<button", c.indexOf("</button>", iAutour)));
  expect(entre).not.toMatch(/<(div|section|header)\b/);
  expect(c).toContain("onClick={() => setCarrousselCarteOuvert((v) => !v)}");
  // L'ancien panneau du bas n'existe plus : ce sont les bulles de la carte qui s'ouvrent.
  expect(c).not.toContain("Carrousel des produits de la carte");
  expect(c).not.toContain("produitsDuCarrousselCarte");
});

test("un toucher ouvre la bulle de TOUTES les boutiques affichées, sans fermer les autres, et les fixe ; le second toucher les ferme toutes", () => {
  const c = g();
  expect(c).toContain("carrousselCarteOuvertRef.current = carrousselCarteOuvert;\n    basculerBullesFixesRef.current(carrousselCarteOuvert);");
  const bascule = c.slice(c.indexOf("basculerBullesFixesRef.current = (ouvert) => {"), c.indexOf("if (carrousselCarteOuvertRef.current) basculerBullesFixesRef.current(true);"));
  expect(bascule).toContain("boutiquesAffichees.forEach((b) => {");
  expect(bascule).toContain("if (ouvert) h.ouvrirFixe?.();");
  expect(bascule).toContain("else h.fermerFixe?.();");
  const ouvrir = c.slice(c.indexOf("const ouvrirFixe = () => {"), c.indexOf("const fermerFixe = () => {"));
  expect(ouvrir).toContain("popup.options.autoClose = false;"); // n'en ferme aucune autre
  expect(ouvrir).toContain("popup.addTo(carte)");
  expect(ouvrir).not.toContain("openOn(");
  expect(ouvrir).not.toContain("panBy"); // la carte ne bouge pas : sinon les déplacements de plusieurs bulles se contrarieraient
});

test("bulles fixées : elles ne se ferment ni à la sortie de la souris ni au bout d'un délai ; reconstruction des marqueurs : fermées puis rouvertes, jamais en double", () => {
  const c = g();
  expect((c.match(/if \(bullesFixesRef\.current\) return;/g) || []).length).toBe(2);
  expect(c).toContain("if (bullesFixesRef.current) basculerBullesFixesRef.current(false);\n    groupe.clearLayers();");
  expect(c).toContain("if (carrousselCarteOuvertRef.current) basculerBullesFixesRef.current(true);");
});

test("bulles qui ne se recouvrent pas : placées côté puis plus haut, dans la carte et sous la barre du haut ; recalculées au zoom", () => {
  const c = g();
  expect(c).toContain("const eviterChevauchementsBulles = () => {");
  expect(c).toContain("carte.on(\"moveend zoomend\", carte.__eviterBulles);"); // chaque déplacement remet les bulles à leur place : le placement est recalculé ensuite
  expect(c).toContain("t.top < hautMini || t.bottom > c.bottom");
  // Une bulle trop haute pour tenir sous la barre du haut reste placeable (colonnes de côté) : la règle du haut ne dépasse jamais sa position naturelle.
  expect(c).toContain("const hautMini = Math.min(haut, r.top) - 0.5;");
  expect(c).toContain("const deplacerBulle = (dx, dy) => {");
  // La carte descend UNE fois pour que les bulles tiennent entièrement sous la barre du haut (au lieu d'être coupées derrière elle).
  expect(c).toContain("carte.panBy([0, -Math.ceil(deficit)], { animate: true, duration: 0.35 });");
  expect(c).toContain("if (deficit > 2 && !carte.__carteDescendue) {");
  expect(c).toContain("carte.__carteDescendue = false;");
});

test("boutiques proches : écartées les unes des autres (jamais empilées), « Vous êtes ici » hors du calcul ; écartement adapté aux épingles de 44 px", async () => {
  const c = g();
  expect(c).toContain("const SEPARER_BOUTIQUES_PROCHES = true;");
  expect(c).toContain("SEPARER_BOUTIQUES_PROCHES ? decalages.get(p.id) : { dx: 0, dy: 0 }");
  expect(c).toContain("const REGROUPER_EN_BULLES = false;"); // pas de bulle « N boutiques » qui masque les boutiques
  expect(c).not.toContain('points.push({ id: "__ici__"'); // ma position ne repousse plus personne
  const { DIAMETRE_AVATAR_PX } = await import("../../src/lib/dissociationMarqueurs.js");
  expect(DIAMETRE_AVATAR_PX).toBeGreaterThanOrEqual(62); // hauteur de l'épingle (56 px) + air : deux épingles voisines ne se recouvrent pas
  const app = lire("mobile/src/components/CarteLeaflet.tsx");
  expect(app).toContain("var grappesActives = carte.getZoom() >= 12;"); // grappes de l'application rétablies (choix du 22/10)
  expect(app).not.toContain("avecMoi = true"); // mais plus avec « Vous êtes ici »
});

test("affichage seulement : aucune écriture en base, adresses d'images inchangées", () => {
  const c = g();
  const bloc = c.slice(c.indexOf("const ouvrirFixe = () => {"), c.indexOf("const eviterChevauchementsBulles") + 200);
  expect(bloc).not.toMatch(/supabase|\.update\(|\.insert\(/);
});
