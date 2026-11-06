const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

// Vue 3D photo (Google Photorealistic 3D Tiles) : interrupteur séparé, garde-fous de coût, repli sur 403 / 429, attribution. Aucun de ces tests n'envoie de requête à Google : le vrai fetch est remplacé par un faux.

const lire = (p) => fs.readFileSync(path.join(__dirname, "..", "..", p), "utf8");

function avecEnv(vars, fn) {
  const avant = {};
  for (const k of Object.keys(vars)) avant[k] = process.env[k];
  try {
    for (const [k, v] of Object.entries(vars)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    return fn();
  } finally {
    for (const [k, v] of Object.entries(avant)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("l'interrupteur de la vue photo est éteint par défaut, exige la clé, et reste fermé en production", async () => {
  const { cartePhotoActive } = await import("../../src/lib/carte3d.js");
  const base = { NEXT_PUBLIC_CARTE_3D: "1", NEXT_PUBLIC_VERCEL_ENV: undefined, NEXT_PUBLIC_CARTE_3D_PHOTO: undefined, NEXT_PUBLIC_GOOGLE_TILES_KEY: "cle-de-test" };
  expect(avecEnv(base, () => cartePhotoActive())).toBe(false); // interrupteur séparé éteint
  expect(avecEnv({ ...base, NEXT_PUBLIC_CARTE_3D_PHOTO: "1" }, () => cartePhotoActive())).toBe(true);
  expect(avecEnv({ ...base, NEXT_PUBLIC_CARTE_3D_PHOTO: "1", NEXT_PUBLIC_GOOGLE_TILES_KEY: "" }, () => cartePhotoActive())).toBe(false); // sans clé
  expect(avecEnv({ ...base, NEXT_PUBLIC_CARTE_3D_PHOTO: "1", NEXT_PUBLIC_VERCEL_ENV: "production", NEXT_PUBLIC_CARTE_3D: "1" }, () => cartePhotoActive())).toBe(false); // jamais en production
  expect(avecEnv({ ...base, NEXT_PUBLIC_CARTE_3D: "0", NEXT_PUBLIC_CARTE_3D_PHOTO: "1", NEXT_PUBLIC_VERCEL_ENV: "preview" }, () => cartePhotoActive())).toBe(true); // aperçu Vercel
  expect(avecEnv({ ...base, NEXT_PUBLIC_CARTE_3D: "0", NEXT_PUBLIC_CARTE_3D_PHOTO: "1", NEXT_PUBLIC_VERCEL_ENV: undefined }, () => cartePhotoActive())).toBe(false); // carte 3D elle-même éteinte
});

test("profil de qualité : appareil modeste allégé (erreur d'écran, mémoire, résolution, inclinaison, requêtes)", async () => {
  const { profilPhoto } = await import("../../src/lib/carte3d.js");
  const modeste = profilPhoto({ navigator: { deviceMemory: 4, hardwareConcurrency: 8 } });
  const fort = profilPhoto({ navigator: { deviceMemory: 8, hardwareConcurrency: 8 } });
  expect(modeste.modeste).toBe(true);
  expect(fort.modeste).toBe(false);
  expect(modeste.erreurEcranMax).toBeGreaterThan(fort.erreurEcranMax);
  expect(modeste.memoireMaxMo).toBeLessThan(fort.memoireMaxMo);
  expect(modeste.ratioPixelMax).toBe(1);
  expect(modeste.inclinaisonMax).toBeLessThan(fort.inclinaisonMax);
  expect(modeste.requetesSimultanees).toBeLessThan(fort.requetesSimultanees);
  expect(profilPhoto({ navigator: { deviceMemory: 8, hardwareConcurrency: 8, connection: { saveData: true } } }).modeste).toBe(true);
  expect(profilPhoto({ navigator: { deviceMemory: 8, hardwareConcurrency: 8, connection: { effectiveType: "3g" } } }).modeste).toBe(true);
  expect(profilPhoto({ navigator: {} }).modeste).toBe(false); // mesures absentes (Safari) : jamais bloquant
});

test("attribution : les « copyright » des tuiles sont agrégés sans doublon, en une ligne", async () => {
  const { creditsAgreges } = await import("../../src/lib/carte3d.js");
  const { copyrightsDesTuiles } = await import("../../src/lib/carte3dPhoto.js");
  expect(creditsAgreges(["Maxar Technologies; CNES / Airbus", "CNES / Airbus", "Maxar Technologies", ""])).toBe("CNES / Airbus; Maxar Technologies");
  expect(creditsAgreges(["Zeta; Alpha", "Alpha"])).toBe("Alpha; Zeta"); // plus fréquent d'abord
  expect(creditsAgreges([])).toBe("");
  expect(copyrightsDesTuiles([{ content: { gltf: { asset: { copyright: "A; B" } } } }, { content: {} }, null])).toEqual(["A; B"]);
});

function fauxFetch(statuts) {
  const appels = [];
  const f = async (url, init) => {
    appels.push({ url, init });
    return new Response(null, { status: statuts.shift() ?? 200 });
  };
  f.appels = appels;
  return f;
}

test("le fetch prêté au moteur ajoute la clé en paramètre, sans en-tête personnalisé, et refuse un autre hôte", async () => {
  const { creerFetchGoogle } = await import("../../src/lib/carte3dPhoto.js");
  const reel = fauxFetch([]);
  const f = creerFetchGoogle({ cle: "CLE_FICTIVE", fetchReel: reel });
  await f("https://tile.googleapis.com/v1/3dtiles/root.json");
  await f("/v1/3dtiles/datasets/X/files/Y.json?session=ABC");
  expect(reel.appels[0].url).toContain("key=CLE_FICTIVE");
  expect(reel.appels[1].url).toContain("session=ABC");
  expect(reel.appels[1].url).toContain("key=CLE_FICTIVE");
  expect(reel.appels[1].url.startsWith("https://tile.googleapis.com/")).toBe(true);
  expect(reel.appels.every((a) => !a.init || !a.init.headers)).toBe(true); // pas de pré-requête CORS
  await expect(f("https://exemple.com/x.json")).rejects.toThrow();
  expect(reel.appels.length).toBe(2);
});

test("une seule requête racine par activation : la seconde est refusée SANS rien envoyer (429) et déclenche le repli", async () => {
  const { creerFetchGoogle } = await import("../../src/lib/carte3dPhoto.js");
  const reel = fauxFetch([]);
  const problemes = [];
  const f = creerFetchGoogle({ cle: "CLE_FICTIVE", fetchReel: reel, surProbleme: (c) => problemes.push(c), maxRacines: 1 });
  expect((await f("https://tile.googleapis.com/v1/3dtiles/root.json")).status).toBe(200);
  expect(f.racines()).toBe(1);
  const refus = await f("https://tile.googleapis.com/v1/3dtiles/root.json");
  expect(refus.status).toBe(429);
  expect(reel.appels.length).toBe(1); // rien n'est parti vers Google
  expect(problemes).toEqual(["limite"]);
  // tout est coupé ensuite : plus aucune requête, même de tuile
  expect((await f("/v1/3dtiles/datasets/X/files/Y.glb?session=ABC")).status).toBe(429);
  expect(reel.appels.length).toBe(1);
});

test("403 (clé refusée) et 429 (quota) coupent la vue photo et préviennent le repli sur le prototype gris", async () => {
  const { creerFetchGoogle } = await import("../../src/lib/carte3dPhoto.js");
  for (const [statut, code] of [[403, "refus"], [429, "quota"]]) {
    const reel = fauxFetch([statut]);
    const problemes = [];
    const f = creerFetchGoogle({ cle: "K", fetchReel: reel, surProbleme: (c) => problemes.push(c) });
    expect((await f("https://tile.googleapis.com/v1/3dtiles/root.json")).status).toBe(statut);
    expect(problemes).toEqual([code]);
    await f("/v1/3dtiles/datasets/X/files/Y.glb");
    expect(reel.appels.length).toBe(1); // coupure : plus de requête après l'échec
  }
});

test("garde-fous dans le code : chargement à la demande, pas de clé écrite, pas de stockage de tuiles, décodeur servi par le site", async () => {
  const carte = lire("src/components/Carte3D.jsx");
  // deck.gl ne doit jamais être importé statiquement par la carte : seulement via l'import dynamique du bouton.
  expect(carte).not.toMatch(/from "@deck\.gl/);
  expect(carte).not.toMatch(/from "@loaders\.gl/);
  expect(carte).toContain('await import("@/lib/carte3dPhoto")');
  expect(carte.match(/import\("@\/lib\/carte3dPhoto"\)/g).length).toBe(1);
  expect(carte).toContain("cartePhotoActive()");
  const photo = lire("src/lib/carte3dPhoto.js");
  expect(photo).toContain('import("@deck.gl/mapbox")');
  expect(photo).not.toMatch(/^import .*@deck\.gl/m);
  expect(photo).toContain("/carte3d/draco/draco_wasm_wrapper.js"); // pas de CDN
  expect(photo).not.toMatch(/unpkg|jsdelivr|gstatic/);
  expect(photo).not.toMatch(/caches\.|indexedDB|localStorage|createWriteStream/i); // jamais de stockage ni de relais des tuiles
  // aucune clé Google en clair dans le dépôt (les clés Google commencent par « AIza »)
  for (const f of ["src/components/Carte3D.jsx", "src/lib/carte3d.js", "src/lib/carte3dPhoto.js", "src/components/TestGoogle3D.jsx", "next.config.mjs"]) expect(lire(f)).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
  expect(fs.existsSync(path.join(__dirname, "..", "..", "public/carte3d/draco/draco_wasm_wrapper.js"))).toBe(true);
  expect(fs.existsSync(path.join(__dirname, "..", "..", "public/carte3d/draco/draco_decoder.wasm"))).toBe(true);
});

test("interface : bouton « Vue 3D photo » séparé, attribution Google Maps, repli lisible, session plafonnée", async () => {
  const carte = lire("src/components/Carte3D.jsx");
  expect(carte).toContain('"Vue 3D photo"');
  expect(carte).toContain("Google Maps");
  expect(carte).toContain("DUREE_MAX_VUE_PHOTO_MS");
  expect(carte).toContain("MESSAGE_REPLI_PHOTO");
  expect(carte).toContain("MAX_RACINES_PAR_PAGE");
  // le bouton 2D/3D et la vue gris existants sont conservés
  expect(carte).toContain("Passer en 2D");
  expect(carte).toContain("Passer en 3D");
  const { DUREE_MAX_VUE_PHOTO_MS, MAX_RACINES_PAR_PAGE } = await import("../../src/lib/carte3d.js");
  expect(DUREE_MAX_VUE_PHOTO_MS).toBeLessThan(3 * 60 * 60 * 1000); // avant la fin des « 3 heures » de session
  expect(MAX_RACINES_PAR_PAGE).toBe(2);
});

test("décalage vertical : constante réglable (52 m par défaut), tuile abaissée une seule fois", async () => {
  const { DECALAGE_VERTICAL_PHOTO_M } = await import("../../src/lib/carte3d.js");
  const { decalerTuile } = await import("../../src/lib/carte3dPhoto.js");
  expect(DECALAGE_VERTICAL_PHOTO_M).toBe(52);
  const tuile = { content: { cartographicOrigin: [-17.43, 14.67, 52.5] } };
  expect(decalerTuile(tuile, 52)).toBe(true);
  expect(tuile.content.cartographicOrigin[2]).toBeCloseTo(0.5, 6); // le sol (52,5 m) arrive à ~0,5 m : au niveau des épingles
  expect(tuile.content.cartographicOrigin.slice(0, 2)).toEqual([-17.43, 14.67]);
  expect(decalerTuile(tuile, 52)).toBe(false); // jamais deux fois
  expect(tuile.content.cartographicOrigin[2]).toBeCloseTo(0.5, 6);
  expect(decalerTuile({ content: {} }, 52)).toBe(false);
  expect(decalerTuile(null, 52)).toBe(false);
  expect(decalerTuile({ content: { cartographicOrigin: [0, 0, 10] } }, 0)).toBe(false); // décalage nul : rien à faire
  // la constante peut être surchargée par la variable d'environnement (essai d'une autre valeur sans toucher au code)
  expect(lire("src/lib/carte3d.js")).toContain("NEXT_PUBLIC_CARTE_3D_PHOTO_DECALAGE_M");

});

test("attribution : « Google Maps » + sources de données dépliables, lien « Sources de données » visible", async () => {
  const carte = lire("src/components/Carte3D.jsx");
  expect(carte).toContain("Sources de données");
  expect(carte).toContain('aria-label="Google Maps. Sources de données"');
});
