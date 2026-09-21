const { test, expect } = require("@playwright/test");
const {
  calculerDecalagesDissociation,
  DIAMETRE_AVATAR_PX,
  DIAMETRE_ICI_PX,
} = require("../../src/lib/dissociationMarqueurs.js");

/**
 * Calcul pur de la dissociation (aucun navigateur, aucun réseau).
 * Positions en pixels écran ; jitter de 1-2 px = boutiques "presque
 * identiques" à un zoom serré (Guinaw Rail Nord).
 */

function pointsQuasiConfondus(n, { avecIci = false } = {}) {
  const pts = Array.from({ length: n }).map((_, i) => ({
    id: `b${i}`,
    x: 500 + (i % 3) * 0.7,
    y: 400 + (i % 2) * 0.9,
  }));
  if (avecIci) pts.push({ id: "__ici__", x: 500, y: 400, ici: true });
  return pts;
}

function positionsFinales(points, decalages) {
  return points.map((p) => ({ id: p.id, x: p.x + decalages.get(p.id).dx, y: p.y + decalages.get(p.id).dy }));
}

function distanceMin(positions) {
  let min = Infinity;
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      min = Math.min(min, Math.hypot(positions[i].x - positions[j].x, positions[i].y - positions[j].y));
    }
  }
  return min;
}

test.describe("Dissociation des marqueurs (calcul pur)", () => {
  for (const echelle of [0.7, 1, 1.4]) {
    for (let n = 2; n <= 10; n++) {
      test(`${n} boutiques quasi confondues, échelle ${echelle} : aucun recouvrement`, () => {
        const points = pointsQuasiConfondus(n);
        const { decalages, groupes } = calculerDecalagesDissociation(points, { echelle });
        expect(groupes).toHaveLength(1);
        expect(groupes[0]).toHaveLength(n);
        expect(distanceMin(positionsFinales(points, decalages))).toBeGreaterThanOrEqual(DIAMETRE_AVATAR_PX * echelle - 1e-6);
      });
    }
  }

  test("une seule boutique : aucun décalage, aucun groupe", () => {
    const { decalages, groupes } = calculerDecalagesDissociation(pointsQuasiConfondus(1), { echelle: 1.2 });
    expect(groupes).toEqual([]);
    expect(decalages.get("b0")).toEqual({ dx: 0, dy: 0 });
  });

  test('"Vous êtes ici" superposé à 1 à 9 boutiques : aucun recouvrement (badge de taille fixe, plus large)', () => {
    for (const echelle of [0.7, 1.1, 1.4]) {
      for (let n = 1; n <= 9; n++) {
        const points = pointsQuasiConfondus(n, { avecIci: true });
        const { decalages } = calculerDecalagesDissociation(points, { echelle });
        const attendu = Math.max(DIAMETRE_ICI_PX, DIAMETRE_AVATAR_PX * echelle);
        expect(distanceMin(positionsFinales(points, decalages)), `n=${n}, échelle ${echelle}`).toBeGreaterThanOrEqual(attendu - 1e-6);
      }
    }
  });

  test("le centre d'un anneau unique (jusqu'à 8 membres) est le barycentre", () => {
    for (let n = 2; n <= 8; n++) {
      const points = pointsQuasiConfondus(n);
      const cx = points.reduce((s, p) => s + p.x, 0) / n;
      const cy = points.reduce((s, p) => s + p.y, 0) / n;
      const finales = positionsFinales(points, calculerDecalagesDissociation(points, { echelle: 1 }).decalages);
      const mx = finales.reduce((s, p) => s + p.x, 0) / n;
      const my = finales.reduce((s, p) => s + p.y, 0) / n;
      expect(Math.hypot(mx - cx, my - cy), `n=${n}`).toBeLessThan(1e-9);
    }
  });

  test("regroupement transitif : une chaîne de 4 boutiques espacées de 40 px forme un seul groupe", () => {
    const points = [0, 1, 2, 3].map((i) => ({ id: `c${i}`, x: 100 + i * 40, y: 100 }));
    const { groupes } = calculerDecalagesDissociation(points, { echelle: 1 });
    expect(groupes).toHaveLength(1);
    expect(groupes[0]).toHaveLength(4);
  });

  test("boutiques éloignées de plus d'un diamètre : intactes", () => {
    const points = [
      { id: "a", x: 100, y: 100 },
      { id: "b", x: 100 + DIAMETRE_AVATAR_PX + 1, y: 100 },
    ];
    const { decalages, groupes } = calculerDecalagesDissociation(points, { echelle: 1 });
    expect(groupes).toEqual([]);
    expect(decalages.get("a")).toEqual({ dx: 0, dy: 0 });
    expect(decalages.get("b")).toEqual({ dx: 0, dy: 0 });
  });

  test("déterministe : mêmes entrées = mêmes sorties (pas de saut entre le geste et le relâchement)", () => {
    const points = pointsQuasiConfondus(7, { avecIci: true });
    const a = calculerDecalagesDissociation(points, { echelle: 1.25 });
    const b = calculerDecalagesDissociation(points, { echelle: 1.25 });
    expect([...a.decalages.entries()]).toEqual([...b.decalages.entries()]);
  });
});
