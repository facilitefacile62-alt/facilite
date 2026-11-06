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

// Boîte fine orientée localement : est, nord, verticale (demi-axe vertical court), centrée à `haut` mètres au-dessus de l'ellipsoïde.
function boiteFine(lieu, p0, haut, demiVertical) {
  const la = (lieu.lat * Math.PI) / 180, lo = (lieu.lng * Math.PI) / 180;
  const est = [-Math.sin(lo), Math.cos(lo), 0];
  const nord = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
  const haut3 = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  const c = p0.map((v, i) => v + haut * haut3[i]);
  return { box: [...c, ...est.map((v) => v * 1000), ...nord.map((v) => v * 1000), ...haut3.map((v) => v * demiVertical)] };
}

test("une boîte fine (demi-axe vertical 40 m) centrée à 60 m ne contient pas le point à 0 m, mais le contient avec la colonne verticale", async () => {
  const { versEcef, rapports, intervalleHauteur, contient, IDENTITE } = await charger();
  const p0 = versEcef(LIEU.lat, LIEU.lng);
  const tuile = { boundingVolume: boiteFine(LIEU, p0, 60, 40) };
  const r0 = rapports(tuile, IDENTITE, p0);
  expect(Math.abs(r0[2])).toBeGreaterThan(1); // à 0 m : -1,5, hors de la boîte (ancienne logique : rejetée)
  const inter = intervalleHauteur(tuile, IDENTITE, LIEU, p0);
  expect(inter).not.toBeNull();
  expect(inter[0]).toBeCloseTo(20, 1);
  expect(inter[1]).toBeCloseTo(100, 1);
  expect(contient(tuile, IDENTITE, LIEU, p0)).toBe(true);
  // une boîte trop haute (centrée à 600 m) n'est pas retenue, même avec la colonne (limite +400 m)
  expect(intervalleHauteur({ boundingVolume: boiteFine(LIEU, p0, 600, 40) }, IDENTITE, LIEU, p0)).toBeNull();
  // une boîte trop basse (centrée à -200 m) non plus
  expect(intervalleHauteur({ boundingVolume: boiteFine(LIEU, p0, -200, 40) }, IDENTITE, LIEU, p0)).toBeNull();
});

test("la descente traverse des boîtes fines situées au-dessus de l'ellipsoïde et rapporte la hauteur trouvée", async () => {
  const { chercherTuile, versEcef, verdictCouverture } = await charger();
  const p0 = versEcef(LIEU.lat, LIEU.lng);
  const fine = { boundingVolume: boiteFine(LIEU, p0, 60, 40), geometricError: 8, content: { uri: "/fin.glb" } };
  const racine = {
    boundingVolume: BOITE_TERRE,
    geometricError: 1e100,
    children: [{ boundingVolume: boiteFine(LIEU, p0, 60, 400), geometricError: 100, children: [fine] }],
  };
  const res = await chercherTuile({ racine, lieu: LIEU, ouvrir: async () => { throw new Error("aucun tileset externe attendu"); }, restantes: () => 20 });
  expect(res.meilleur.uri).toBe("/fin.glb");
  expect(res.meilleur.hauteur).toBeCloseTo(60, 1);
  expect(verdictCouverture(res).code).toBe("COUVERT");
});
