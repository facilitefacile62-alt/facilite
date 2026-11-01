const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Touche « Carrousel » DANS la carte (Autour de moi), juste après la touche « Autour de moi » : un toucher fixe un panneau avec tous les produits des boutiques de la carte,
 * qui reste ouvert jusqu'à la croix ou un second toucher. Elle n'existe pas sur les cartes produit de la liste.
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");
const mod = () => import("../../src/lib/carrousselCarte.js");

test("produits du carrousel : seulement ceux des boutiques affichées, avec photo, sans doublon, dans l'ordre", async () => {
  const { produitsDuCarrousselCarte } = await mod();
  const boutiques = [{ id: "b1" }, { id: 2 }];
  const articles = [
    { id: "a1", boutique_id: "b1", photos: ["x.jpg"], titre: "A" },
    { id: "a2", boutique_id: "autre", photos: ["y.jpg"] }, // boutique non affichée
    { id: "a3", boutique_id: "b1", photos: [] }, // sans photo
    { id: "a4", boutique_id: 2, photos: ["z.jpg"] },
    { id: "a1", boutique_id: "b1", photos: ["x.jpg"] }, // doublon
    { id: "a5", boutiqueId: "b1", photos: ["w.jpg"] },
    { id: "a6", photos: ["v.jpg"] }, // sans boutique
    null,
  ];
  expect(produitsDuCarrousselCarte(articles, boutiques).map((a) => a.id)).toEqual(["a1", "a4", "a5"]);
  expect(produitsDuCarrousselCarte(null, boutiques)).toEqual([]);
  expect(produitsDuCarrousselCarte(articles, null)).toEqual([]);
});

test("carte : touche « Carrousel » dans la rangée de touches, juste après « Autour de moi » et avant « Trouver un livreur »", () => {
  const g = lire("src/components/GlobeExplorateurBoutiques.jsx");
  const iAutour = g.indexOf("<span>Autour de moi</span>");
  const iCarrousel = g.indexOf("<span>Carrousel</span>");
  const iLivreur = g.indexOf("<span>Trouver un livreur</span>");
  expect(iAutour).toBeGreaterThan(0);
  expect(iCarrousel).toBeGreaterThan(iAutour);
  expect(iLivreur).toBeGreaterThan(iCarrousel);
  // Rien d'autre entre les deux touches qu'un bouton : elles sont voisines dans la même rangée.
  const entre = g.slice(g.indexOf("</button>", iAutour), g.indexOf("<button", g.indexOf("</button>", iAutour)));
  expect(entre).not.toMatch(/<(div|section|header)\b/);
  expect(g).toContain("onClick={() => setCarrousselCarteOuvert((v) => !v)}");
});

test("panneau fixe : reste ouvert tant qu'on ne le ferme pas (croix ou second toucher), tous les produits à faire défiler, toucher un produit ouvre sa fiche", () => {
  const g = lire("src/components/GlobeExplorateurBoutiques.jsx");
  const panneau = g.slice(g.indexOf("{carrousselCarteOuvert && ("), g.indexOf("</section>", g.indexOf("{carrousselCarteOuvert && (")));
  expect(panneau).toContain('role="dialog"');
  expect(panneau).toContain("absolute inset-x-0 bottom-0");
  expect(panneau).toContain("snap-x snap-mandatory");
  expect(panneau).toContain("onClick={() => setCarrousselCarteOuvert(false)}");
  expect(panneau).toContain("onClick={() => onVoirArticle?.(a)}");
  expect(panneau).toContain("src={adresseImage(urlPhoto(a.photos[0]))}");
  // Ni fermeture au survol ni à la sortie de la souris : « une fois touché, ça reste ».
  expect(panneau).not.toMatch(/onMouseLeave|onPointerLeave|setTimeout/);
  expect(g).toContain("const [carrousselCarteOuvert, setCarrousselCarteOuvert] = useState(false);");
});

test("la touche n'existe plus sur les cartes produit de la liste (elle est seulement dans la carte) ; affichage seulement, aucune écriture en base", () => {
  const m = lire("src/app/marketplace/MarketplaceClient.jsx");
  expect(m).not.toMatch(/Carrousel|CarrousselPhotos|carroussel/i);
  const g = lire("src/lib/carrousselCarte.js");
  expect(g).not.toMatch(/supabase|\.update\(|\.insert\(/);
});
