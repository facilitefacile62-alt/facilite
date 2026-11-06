const { test, expect } = require("@playwright/test");

// Structure imaginaire qui reproduit le cas réel de Google : 4 enfants de la racine avec EXACTEMENT la même boîte (la Terre entière), dont un seul mène au point.
// L'ancienne descente (« premier enfant qui contient le point ») s'arrêtait dans l'enfant 0, qui est une impasse. Le retour arrière doit trouver l'enfant 3.

const LIEU = { lat: 14.6708, lng: -17.4377 };
const R = 7645212;
const BOITE_TERRE = { box: [0, 0, 0, R, 0, 0, 0, R, 0, 0, 0, R] };

async function charger() {
  return import("../../src/lib/couvertureTuiles3d.js");
}
function boiteAutour(p, demi) {
  return { box: [p[0], p[1], p[2], demi, 0, 0, 0, demi, 0, 0, 0, demi] };
}

function construire(p) {
  const autour = boiteAutour(p, 5000);
  const ailleurs = boiteAutour([-p[0], -p[1], -p[2]], 5000); // à l'opposé de la Terre : ne contient pas le point
  const racine = {
    boundingVolume: BOITE_TERRE,
    geometricError: 1e100,
    children: [
      // enfant 0 : contient le point jusqu'à un tileset externe qui se révèle vide (impasse)
      { boundingVolume: BOITE_TERRE, geometricError: 1e100, children: [{ boundingVolume: autour, geometricError: 131489, content: { uri: "/impasse.json?session=XXX" } }] },
      // enfant 1 : boîtes qui ne contiennent pas le point
      { boundingVolume: BOITE_TERRE, geometricError: 1e100, children: [{ boundingVolume: ailleurs, geometricError: 131489, content: { uri: "/ailleurs.json" } }] },
      // enfant 2 : idem
      { boundingVolume: BOITE_TERRE, geometricError: 1e100, children: [{ boundingVolume: ailleurs, geometricError: 131489, content: { uri: "/ailleurs2.json" } }] },
      // enfant 3 : le bon chemin
      { boundingVolume: BOITE_TERRE, geometricError: 1e100, children: [{ boundingVolume: autour, geometricError: 131489, content: { uri: "/bon.json?session=XXX" } }] },
    ],
  };
  const tilesets = {
    "/impasse.json?session=XXX": { root: { boundingVolume: autour, geometricError: 131489, children: [] } },
    "/bon.json?session=XXX": {
      root: {
        boundingVolume: autour,
        geometricError: 131489,
        children: [{ boundingVolume: autour, geometricError: 30, content: { uri: "/fin.glb?session=XXX" } }],
      },
    },
  };
  return { racine, tilesets };
}

test("le retour arrière trouve l'enfant 3 quand les 4 enfants de la racine ont la même boîte", async () => {
  const { chercherTuile, versEcef, verdictCouverture } = await charger();
  const { racine, tilesets } = construire(versEcef(LIEU.lat, LIEU.lng));
  const ouverts = [];
  let restant = 14;
  const res = await chercherTuile({
    racine,
    lieu: LIEU,
    ouvrir: async (uri) => { ouverts.push(uri); restant--; return tilesets[uri]; },
    restantes: () => restant,
  });
  expect(res.plafond).toBe(false);
  expect(res.meilleur.uri).toBe("/fin.glb?session=XXX");
  expect(res.meilleur.ge).toBe(30);
  expect(res.meilleur.chemin[0]).toBe(3); // enfant 3 de la racine
  expect(ouverts).toContain("/impasse.json?session=XXX"); // l'impasse a bien été essayée, puis abandonnée
  expect(ouverts).toContain("/bon.json?session=XXX");
  expect(ouverts.some((u) => u.includes("ailleurs"))).toBe(false); // les boîtes qui ne contiennent pas le point ne coûtent aucune requête
  expect(verdictCouverture(res).code).toBe("COUVERT"); // 30 m <= seuil de 32 m
});

test("plafond de requêtes : INDÉTERMINÉ, jamais « non couvert »", async () => {
  const { chercherTuile, versEcef, verdictCouverture } = await charger();
  const { racine, tilesets } = construire(versEcef(LIEU.lat, LIEU.lng));
  let restant = 1; // une seule requête en réserve : aucun tileset externe ne peut être ouvert
  const res = await chercherTuile({ racine, lieu: LIEU, ouvrir: async (uri) => { restant--; return tilesets[uri]; }, restantes: () => restant });
  expect(res.plafond).toBe(true);
  expect(res.meilleur).toBeNull();
  expect(verdictCouverture(res).code).toBe("INDETERMINE");
});

test("verdicts : grossier = PARTIEL, rien trouvé et arbre épuisé = AUCUNE_TUILE", async () => {
  const { verdictCouverture } = await charger();
  expect(verdictCouverture({ meilleur: { ge: 500 }, plafond: false }).code).toBe("PARTIEL");
  expect(verdictCouverture({ meilleur: { ge: 12 }, plafond: false }).code).toBe("COUVERT");
  expect(verdictCouverture({ meilleur: { ge: 500 }, plafond: true }).code).toBe("INDETERMINE");
  expect(verdictCouverture({ meilleur: null, plafond: false }).code).toBe("AUCUNE_TUILE");
});

test("l'ancien défaut est bien reproduit : le premier enfant seul est une impasse", async () => {
  const { contient, versEcef, IDENTITE } = await charger();
  const p = versEcef(LIEU.lat, LIEU.lng);
  const { racine } = construire(p);
  // les 4 enfants de la racine contiennent tous le point : l'ordre seul ne permet pas de choisir
  expect(racine.children.every((e) => contient(e, IDENTITE, LIEU, p))).toBe(true);
});
