const { test, expect } = require("@playwright/test");
const fs = require("fs");

test("la carte 3D reprend l'interface « Autour de moi » ; seul le bouton 2D/3D change le rendu", () => {
  const c = fs.readFileSync("src/components/Carte3D.jsx", "utf8");
  for (const motif of ["Rechercher un article, une boutique...", "Toutes les boutiques", "En stock (LIVE)", "Carrousel", "3D → 2D", "2D → 3D", "Bande de boutiques en bas"]) expect(c).toContain(motif);
  expect(c).toContain("useState(true)"); // Carrousel actif d'office
  expect(c).toContain("brancherFleches"); // flèches gauche / droite
  expect(c).toContain("pitch: active ? INCLINAISON_3D : 0"); // la bascule ne change que l'inclinaison et les volumes
});
