const { test, expect } = require("@playwright/test");
const fs = require("fs");

test("la carte 3D est éteinte par défaut ; elle s'allume avec l'interrupteur ou sur un aperçu Vercel", async () => {
  const avant = { c: process.env.NEXT_PUBLIC_CARTE_3D, v: process.env.NEXT_PUBLIC_VERCEL_ENV };
  try {
    const { carte3dActive } = await import("../../src/lib/carte3d.js");
    delete process.env.NEXT_PUBLIC_CARTE_3D;
    delete process.env.NEXT_PUBLIC_VERCEL_ENV;
    expect(carte3dActive()).toBe(false);
    process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
    expect(carte3dActive()).toBe(false);
    process.env.NEXT_PUBLIC_CARTE_3D = "0";
    expect(carte3dActive()).toBe(false);
    process.env.NEXT_PUBLIC_CARTE_3D = "1";
    expect(carte3dActive()).toBe(true);
    delete process.env.NEXT_PUBLIC_CARTE_3D;
    process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";
    expect(carte3dActive()).toBe(true);
  } finally {
    if (avant.c === undefined) delete process.env.NEXT_PUBLIC_CARTE_3D; else process.env.NEXT_PUBLIC_CARTE_3D = avant.c;
    if (avant.v === undefined) delete process.env.NEXT_PUBLIC_VERCEL_ENV; else process.env.NEXT_PUBLIC_VERCEL_ENV = avant.v;
  }
});

test("la page /carte-3d est un 404 quand l'interrupteur est éteint, n'est jamais indexée et n'écrit aucune boutique dans son HTML", () => {
  const page = fs.readFileSync("src/app/carte-3d/page.js", "utf8");
  expect(page).toContain("if (!carte3dActive()) notFound();");
  expect(page).toContain("robots: { index: false, follow: false }");
  expect(page).not.toMatch(/boutique_lat|latitude|longitude|chargerTousLesArticles/);
  const client = fs.readFileSync("src/components/Carte3DClient.jsx", "utf8");
  expect(client).toContain("ssr: false"); // chargement différé : MapLibre n'est téléchargé que sur cette page
});

test("repli : appareil faible, WebGL absent, fond injoignable et lenteur renvoient vers la carte 2D actuelle", () => {
  const lib = fs.readFileSync("src/lib/carte3d.js", "utf8");
  for (const motif of ["deviceMemory <= 2", "hardwareConcurrency <= 2", "saveData", "2g", "WebGL absent"]) expect(lib).toContain(motif);
  const c = fs.readFileSync("src/components/Carte3D.jsx", "utf8");
  expect(c).toContain("window.location.replace(ADRESSE_CARTE_2D)");
  expect(c).toContain("webglcontextlost");
  expect(c).toContain("DELAI_CHARGEMENT_MS");
  expect(c).toContain("> 70"); // mesure de fluidité : repli en vue plate si moins de 14 images par seconde
  expect(c).toContain('data: "/carte3d/batiments.geojson"');
});

test("aucune clé ni secret dans la carte 3D (fond OpenFreeMap sans clé)", () => {
  for (const p of ["src/components/Carte3D.jsx", "src/lib/carte3d.js", "scripts/carte3d/extraire-batiments.py"]) {
    const t = fs.readFileSync(p, "utf8");
    expect(t).not.toMatch(/api[_-]?key|access[_-]?token|apikey|sk\.[A-Za-z0-9]{20}|AIza[0-9A-Za-z_-]{20}/i);
  }
  expect(fs.readFileSync("src/components/Carte3D.jsx", "utf8")).toContain("https://tiles.openfreemap.org/styles/positron");
});
