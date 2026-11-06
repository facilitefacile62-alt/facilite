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
  const { creerFetchGoogle, creerEtatSession } = await import("../../src/lib/carte3dPhoto.js");
  const reel = fauxFetch([]);
  const f = creerFetchGoogle({ cle: "CLE_FICTIVE", fetchReel: reel, etat: creerEtatSession() });
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

test("une racine déjà obtenue est rejouée depuis la mémoire (aucune requête) ; le plafond de racines réelles coupe tout, sans rien envoyer", async () => {
  const { creerFetchGoogle, creerEtatSession } = await import("../../src/lib/carte3dPhoto.js");
  const reel = fauxFetch([]);
  const problemes = [];
  const f = creerFetchGoogle({ cle: "CLE_FICTIVE", fetchReel: reel, surProbleme: (c) => problemes.push(c), maxRacines: 1, etat: creerEtatSession() });
  expect((await f("https://tile.googleapis.com/v1/3dtiles/root.json")).status).toBe(200);
  expect(f.racines()).toBe(1);
  expect((await f("https://tile.googleapis.com/v1/3dtiles/root.json")).status).toBe(200); // rejouée depuis la mémoire
  expect(reel.appels.length).toBe(1); // rien de plus n'est parti vers Google
  expect(problemes).toEqual([]);
  // plafond atteint (maxRacines: 0) : refus sans rien envoyer et coupure totale
  const reel2 = fauxFetch([]);
  const p2 = [];
  const g = creerFetchGoogle({ cle: "CLE_FICTIVE", fetchReel: reel2, surProbleme: (c) => p2.push(c), maxRacines: 0, etat: creerEtatSession() });
  expect((await g("https://tile.googleapis.com/v1/3dtiles/root.json")).status).toBe(429);
  expect(p2).toEqual(["limite"]);
  expect((await g("/v1/3dtiles/datasets/X/files/Y.glb?session=ABC")).status).toBe(429);
  expect(reel2.appels.length).toBe(0);
});

test("403 (clé refusée) et 429 (quota) coupent la vue photo et préviennent le repli sur le prototype gris", async () => {
  const { creerFetchGoogle, creerEtatSession } = await import("../../src/lib/carte3dPhoto.js");
  for (const [statut, code] of [[403, "refus"], [429, "quota"]]) {
    const reel = fauxFetch([statut]);
    const problemes = [];
    const f = creerFetchGoogle({ cle: "K", fetchReel: reel, surProbleme: (c) => problemes.push(c), etat: creerEtatSession() });
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
  expect(carte).toContain("lancerPhoto");
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

test("fluidité mesurée seulement après l'affichage des premières tuiles ; délai maximal de 60 s avec repli", async () => {
  const carte = lire("src/components/Carte3D.jsx");
  expect(carte).toContain("surAffichee");
  expect(carte).toContain("DELAI_PREMIERES_TUILES_MS = 60000");
  expect(carte).toContain("met trop de temps à répondre");
  // la surveillance de fluidité n'est lancée que depuis surAffichee (pas à l'ouverture, pas à l'arrivée de la racine)
  expect(carte.match(/surveillerFluidite\(\)/g).length).toBe(1);
  expect(carte).not.toContain("surPret");
  const photo = lire("src/lib/carte3dPhoto.js");
  expect(photo).toContain("surAffichee()");
  expect(photo).toContain("tileDrawn");
});

test("zone de mesures (aperçus seulement) : racine, première tuile reçue / affichée, tuiles chargées, dernière erreur", async () => {
  const carte = lire("src/components/Carte3D.jsx");
  expect(carte).toContain('NEXT_PUBLIC_VERCEL_ENV === "preview"');
  for (const m of ["Racine :", "1re tuile reçue", "1re tuile affichée", "Tuiles chargées", "Dernière erreur"]) expect(carte).toContain(m);
  const { creerMesures, texteSansSecret, creerFetchGoogle, creerEtatSession } = await import("../../src/lib/carte3dPhoto.js");
  let t = 1000;
  const m = creerMesures(() => t);
  t = 3500;
  m.tuileRecue();
  t = 4200;
  expect(m.tuileAffichee()).toBe(3200);
  t = 9000;
  m.tuileRecue(); // seule la première compte
  m.tuileAffichee();
  m.tuileChargee();
  m.tuileChargee();
  m.racine(30763, 200);
  m.erreur("HTTP 403 https://tile.googleapis.com/x?key=SECRET&session=ABC123");
  const d = m.donnees();
  expect(d).toMatchObject({ racineMs: 30763, racineStatut: 200, premiereRecueMs: 2500, premiereAfficheeMs: 3200, tuilesChargees: 2 });
  expect(d.derniereErreur).not.toContain("SECRET");
  expect(d.derniereErreur).not.toContain("ABC123");
  expect(texteSansSecret("a?key=SECRET&b=1")).toBe("a?key=XXX&b=1");
  // le fetch émet des événements de mesure (racine, tuile, erreur) sans jamais y mettre la clé
  const evts = [];
  let h = 0;
  const f = creerFetchGoogle({
    cle: "CLE_FICTIVE",
    fetchReel: async () => new Response(null, { status: 200 }),
    surEvenement: (e) => evts.push(e),
    maintenant: () => (h += 500),
    etat: creerEtatSession(),
  });
  await f("https://tile.googleapis.com/v1/3dtiles/root.json");
  await f("/v1/3dtiles/datasets/X/files/Y.glb?session=ABC");
  expect(evts[0]).toEqual({ type: "racine", ms: 500, status: 200 });
  expect(evts[1].type).toBe("tuile");
  expect(JSON.stringify(evts)).not.toContain("CLE_FICTIVE");
});

test("logo officiel Google Maps : fichier fourni par Google, non modifié, affiché à 18 px avec texte alternatif « Google Maps »", async () => {
  const carte = lire("src/components/Carte3D.jsx");
  expect(carte).toContain("/carte3d/google-maps-logo.svg");
  expect(carte).toContain('alt="Google Maps"');
  expect(carte).toContain("height: 18"); // entre 16 et 19 dp exigés par Google
  const svg = lire("public/carte3d/google-maps-logo.svg");
  expect(svg).toContain('width="105px" height="22px"'); // dimensions d'origine, proportions conservées par « width: auto »
  expect(svg).not.toMatch(/<script|onload/i);
});

function fauxFetchRacine(corps) {
  const appels = [];
  const f = async (url) => {
    appels.push(url);
    return new Response(/root\.json/.test(url) ? corps : null, { status: 200 });
  };
  f.appels = appels;
  return f;
}

test("relance sans nouvelle requête racine tant que la session est valable ; nouvelle racine seulement après expiration", async () => {
  const { creerFetchGoogle, creerEtatSession } = await import("../../src/lib/carte3dPhoto.js");
  const { DUREE_MAX_VUE_PHOTO_MS } = await import("../../src/lib/carte3d.js");
  const etat = creerEtatSession(); // état de la page : partagé par toutes les activations
  const reel = fauxFetchRacine('{"root":{"children":[]}}');
  let horloge = 1000;
  const evts = [];
  const nouvelleActivation = () => creerFetchGoogle({ cle: "K", fetchReel: reel, etat, maintenant: () => horloge, surEvenement: (e) => evts.push(e.type) });
  // 1re activation : une vraie requête racine
  const a1 = nouvelleActivation();
  const r1 = await a1("https://tile.googleapis.com/v1/3dtiles/root.json");
  expect(r1.status).toBe(200);
  expect(reel.appels.length).toBe(1);
  expect(etat.racines).toBe(1);
  // « Continuer quand même » ou nouvel appui : nouvelle activation, la racine vient de la mémoire (aucune requête)
  horloge += 10 * 60 * 1000;
  const a2 = nouvelleActivation();
  const r2 = await a2("https://tile.googleapis.com/v1/3dtiles/root.json");
  expect(r2.status).toBe(200);
  expect(await r2.json()).toEqual({ root: { children: [] } });
  expect(reel.appels.length).toBe(1); // toujours une seule requête racine envoyée
  expect(etat.racines).toBe(1);
  expect(evts).toContain("racine-reutilisee");
  // les tuiles, elles, sont redemandées à Google (le moteur est neuf)
  await a2("/v1/3dtiles/datasets/X/files/Y.glb?session=ABC");
  expect(reel.appels.length).toBe(2);
  // session expirée : nouvelle requête racine réelle (deuxième et dernière autorisée par page)
  horloge += DUREE_MAX_VUE_PHOTO_MS + 1000;
  const a3 = nouvelleActivation();
  await a3("https://tile.googleapis.com/v1/3dtiles/root.json");
  expect(reel.appels.filter((u) => /root\.json/.test(u)).length).toBe(2);
  expect(etat.racines).toBe(2);
  // une troisième racine réelle est refusée sans rien envoyer
  horloge += DUREE_MAX_VUE_PHOTO_MS + 1000;
  const problemes = [];
  const a4 = creerFetchGoogle({ cle: "K", fetchReel: reel, etat, maintenant: () => horloge, surProbleme: (c) => problemes.push(c) });
  expect((await a4("https://tile.googleapis.com/v1/3dtiles/root.json")).status).toBe(429);
  expect(problemes).toEqual(["limite"]);
  expect(reel.appels.filter((u) => /root\.json/.test(u)).length).toBe(2);
});

test("une racine refusée (403) n'est pas gardée en mémoire", async () => {
  const { creerFetchGoogle, creerEtatSession } = await import("../../src/lib/carte3dPhoto.js");
  const etat = creerEtatSession();
  const f = creerFetchGoogle({ cle: "K", fetchReel: async () => new Response("interdit", { status: 403 }), etat });
  await f("https://tile.googleapis.com/v1/3dtiles/root.json");
  expect(etat.texteRacine).toBeNull();
});

test("réglage ?photo=sans-coupure et bouton « Continuer quand même »", async () => {
  const carte = lire("src/components/Carte3D.jsx");
  expect(carte).toContain('get("photo") === "sans-coupure"');
  expect(carte).toContain("Durée moyenne par image");
  expect(carte).toContain("Continuer quand même");
  expect(carte).toContain("continuerQuandMeme");
  expect(carte).toContain("lancerPhoto(true)");
  // le contrôle de fluidité de la carte grise est lui aussi désactivé par le réglage
  expect(carte).toContain("!sansCoupureDemande() && (performance.now() - debut) / n > 70");
  // le message de coupure indique la durée moyenne mesurée
  expect(carte).toContain("ms par image en moyenne");
  // un seul import dynamique du module photo (le bouton « Continuer quand même » réutilise lancerPhoto)
  expect(carte.match(/import\("@\/lib\/carte3dPhoto"\)/g).length).toBe(1);
});

test("vue photo : épingles au-dessus de la couche photo, une épingle par boutique, vue grise inchangée", async () => {
  const carte = lire("src/components/Carte3D.jsx");
  // cause : le conteneur de deck.gl est dans un coin de commandes MapLibre (z-index 2), au-dessus des épingles et des bulles (z-index automatique)
  expect(carte).toContain(".carte-photo .maplibregl-marker,.carte-photo .maplibregl-popup{z-index:3}");
  // sous la photo, la mention OpenFreeMap / Overture (fond masqué) est retirée : elle recouvrait le logo et les sources de Google sur un écran étroit
  expect(carte).toContain(".carte-photo .maplibregl-ctrl-bottom-right{display:none}");
  expect(carte).toContain('photo === "on" ? " carte-photo" : ""');
  // l'interface (recherche, touches, bande de boutiques) reste au-dessus des épingles
  expect(carte.match(/zIndex: 4/g).length).toBeGreaterThanOrEqual(2);
  // une épingle par boutique dans les deux vues : plus aucun regroupement
  expect(carte).toContain('const enPhoto = photo === "on";');
  expect(carte).toContain("}, [visibles, carrousel, etat, photo, placerPins, planifierPlacement]);");
  const css = fs.readFileSync(path.join(__dirname, "..", "..", "node_modules/maplibre-gl/dist/maplibre-gl.css"), "utf8");
  expect(css).toMatch(/\.maplibregl-ctrl-top-right\{position:absolute;pointer-events:none;z-index:2\}|maplibregl-ctrl-top-right\{position:absolute;pointer-events:none;z-index:2/);
});

test("boutiques de test : visibles seulement en preview (masquage dans le code, sans toucher à la base)", async () => {
  const { estBoutiqueDeTest, boutiquesVisibles, IDS_BOUTIQUES_TEST } = await import("../../src/lib/boutiquesTest.js");
  expect(IDS_BOUTIQUES_TEST.size).toBe(3);
  expect(estBoutiqueDeTest({ id: "d23fe736-1609-464b-a5c4-dacd19b0203c", nom: "facile demo" })).toBe(true);
  expect(estBoutiqueDeTest({ id: "dd828aa7-a34f-4bfa-b7c6-a12967c92d8b", nom: "masque" })).toBe(true);
  expect(estBoutiqueDeTest({ id: "zzz", nom: "Candidat Test E2E" })).toBe(true); // par le nom
  expect(estBoutiqueDeTest({ id: "zzz", nom: "Boutique e2e 12" })).toBe(true);
  expect(estBoutiqueDeTest({ id: "zzz", nom: "Ndiaye électrique" })).toBe(false);
  expect(estBoutiqueDeTest({ id: "zzz", nom: "Fastest Phones" })).toBe(false); // « test » seulement en mot entier
  const liste = [{ id: "d23fe736-1609-464b-a5c4-dacd19b0203c", nom: "facile demo" }, { id: "r1", nom: "Fayli Shop" }, { id: "r2", nom: "Candidat Test E2E" }];
  expect(boutiquesVisibles(liste, true).length).toBe(3); // preview : tout
  expect(boutiquesVisibles(liste, false).map((b) => b.nom)).toEqual(["Fayli Shop"]); // production : sans les tests
  const carte = lire("src/components/Carte3D.jsx");
  expect(carte).toContain("boutiquesVisibles(construireBoutiques(articles, logos), EN_PREVIEW)");
  expect(carte).toContain('const EN_PREVIEW = process.env.NEXT_PUBLIC_VERCEL_ENV === "preview"');
});

test("vue photo : carrousel dans un panneau FIXE en bas (au-dessus de la bande de boutiques), une seule boutique à la fois, jamais sous la recherche", async () => {
  const carte = lire("src/components/Carte3D.jsx");
  // pas de bulle sur la carte en vue photo (ni, désormais, en vue grise)
  expect(carte).toContain("setPanneau({ boutiques: [e.b], index: 0 })");
  expect(carte).not.toContain("Popup");
  // le panneau est dans la colonne du bas, entre le message et la bande de boutiques, donc fixe à l'écran
  const iPanneau = carte.indexOf('role="dialog"');
  const iBande = carte.indexOf('className="flex max-w-full gap-3 overflow-x-auto rounded-full bg-white/70');
  const iColonne = carte.indexOf('${photo === "on" ? "bottom-0" : "bottom-4"}');
  expect(iColonne).toBeGreaterThan(0);
  expect(iPanneau).toBeGreaterThan(iColonne);
  expect(iPanneau).toBeLessThan(iBande);
  expect(carte).toContain('maxHeight: "42vh"'); // ne monte jamais jusqu'à la barre de recherche
  expect(carte).toContain("aria-label=\"Fermer le carrousel\"");
  // un seul panneau : l'état est un seul objet { boutiques, index } ; choisir une autre épingle le remplace
  expect(carte.match(/useState\(null\); \/\/ vue photo : \{ boutiques, index \}/g).length).toBe(1);
  // l'épingle choisie passe devant les autres ; un clic sur la carte ferme le panneau ; un clic sur une épingle ne le ferme pas
  expect(carte).toContain('el.style.zIndex = id === choisie ? "10" : photo === "on" ? "1" : "";');
  expect(carte).toContain('carte.on("click", fermer)');
  expect(carte).toContain("ev.stopPropagation()");
  // une épingle = une boutique : plus de pastilles de choix dans le panneau
  expect(carte).not.toContain("setPanneau({ boutiques: panneau.boutiques, index: k })");
  // l'interface (z-index 40/45) reste au-dessus de l'épingle choisie (z-index 10)
  expect(carte).not.toMatch(/zIndex: 4 \}/);
  expect(carte).toMatch(/zIndex: 40/);
  // htmlBulle sans largeur => mêmes dimensions que la bulle d'origine (utilisée désormais par le panneau fixe des deux vues)
  expect(carte).toContain("function htmlBulle(b, largeur = 140)");
});

test("caméra de la vue photo : zoom et inclinaison bornés, brume à la place du vide, fond MapLibre masqué", async () => {
  const { profilPhoto } = await import("../../src/lib/carte3d.js");
  const fort = profilPhoto({ navigator: { deviceMemory: 8, hardwareConcurrency: 8 } });
  const modeste = profilPhoto({ navigator: { deviceMemory: 4, hardwareConcurrency: 8 } });
  expect(fort.zoomMax).toBe(17);
  expect(modeste.zoomMax).toBe(16.5);
  expect(fort.inclinaisonMax).toBe(55);
  expect(modeste.inclinaisonMax).toBe(50);
  // au-dessus de ~66° le haut de l'écran approche de l'horizon : la portée de vue de deck.gl (10 fois la distance de la caméra) coupe le sol
  const fov = 2 * Math.atan(1 / 3); // altitude 1,5 de deck.gl
  for (const pitchDeg of [fort.inclinaisonMax, modeste.inclinaisonMax]) {
    const p = (pitchDeg * Math.PI) / 180;
    const haut = (Math.sin(fov / 2)) / Math.sin(Math.PI / 2 - p - fov / 2);
    const plusLoin = Math.sin(p) * haut + 1; // en distances de caméra
    expect(plusLoin).toBeLessThan(3);
  }
  const carte = lire("src/components/Carte3D.jsx");
  expect(carte).toContain("carte.setMaxZoom(profil.zoomMax)");
  expect(carte).toContain("carte.setMaxZoom(22)"); // restauré en quittant la vue photo
  expect(carte).toContain("linear-gradient(to bottom, #aebfd3");
  expect(carte).toContain(".carte-photo .maplibregl-canvas{opacity:0}");
});

test("zone de mesures : fluidité toujours affichée en aperçu (plus besoin de ?photo=sans-coupure) et statistiques des tuiles", async () => {
  const carte = lire("src/components/Carte3D.jsx");
  expect(carte).toContain("if (MONTRER_MESURES || sansCoupure) mesurerEnContinu();");
  expect(carte).not.toContain("{sansCoupureDemande() && <div>Durée moyenne par image");
  expect(carte).toContain("dans la vue");
  expect(carte).toContain("échecs");
  const photo = lire("src/lib/carte3dPhoto.js");
  for (const nom of ["Tiles In View", "Tiles To Render", "Tiles Loading", "Failed Tile Loads"]) expect(photo).toContain(nom);
  const { creerMesures } = await import("../../src/lib/carte3dPhoto.js");
  const m = creerMesures(() => 0);
  m.tuiles({ dansVue: 12, aAfficher: 9, enCours: 3, echecs: 0 });
  expect(m.donnees().tuiles).toEqual({ dansVue: 12, aAfficher: 9, enCours: 3, echecs: 0 });
});

test("panneau du carrousel : jamais recouvert par le bouton « + » du site (marge à droite sur téléphone, largeur adaptée)", async () => {
  const carte = lire("src/components/Carte3D.jsx");
  expect(carte).toContain("self-start");
  expect(carte).toContain("sm:self-center");
  expect(carte).toContain("Math.max(140, Math.min(276, window.innerWidth - 188))");
  expect(carte).toContain("htmlBulle(boutiqueDuPanneau, largeurCarrousel)");
  // largeur du panneau = carrousel + 32 (bulle) + 52 (marges) ; le bord droit du panneau doit rester à 80 px au moins du bord de l'écran (bouton « + » : ~64 px + marge)
  for (const ecran of [360, 390, 420, 480]) {
    const l = Math.max(140, Math.min(276, ecran - 188));
    const bordDroit = 12 + l + 32 + 52;
    expect(ecran - bordDroit).toBeGreaterThanOrEqual(80);
  }
});

test("réglages d'essai par variables Vercel : zoom maximal et erreur d'écran (valeurs par défaut 17 / 16,5 et 16 / 48)", async () => {
  const { profilPhoto, reglageNumerique } = await import("../../src/lib/carte3d.js");
  const nav = { deviceMemory: 8, hardwareConcurrency: 8 };
  const modeste = { deviceMemory: 4, hardwareConcurrency: 8 };
  const sans = { zoomMax: null, erreurEcran: null };
  expect(profilPhoto({ navigator: nav, reglages: sans })).toMatchObject({ zoomMax: 17, erreurEcranMax: 16 });
  expect(profilPhoto({ navigator: modeste, reglages: sans })).toMatchObject({ zoomMax: 16.5, erreurEcranMax: 48 });
  // réglages valides : appliqués aux deux profils
  expect(profilPhoto({ navigator: nav, reglages: { zoomMax: 15.5, erreurEcran: 8 } })).toMatchObject({ zoomMax: 15.5, erreurEcranMax: 8 });
  expect(profilPhoto({ navigator: modeste, reglages: { zoomMax: 15.5, erreurEcran: 8 } })).toMatchObject({ zoomMax: 15.5, erreurEcranMax: 8 });
  // lecture de la variable : valeur absente, vide, hors bornes ou non numérique => défaut du profil (null)
  expect(reglageNumerique("17.5", 10, 22)).toBe(17.5);
  expect(reglageNumerique(" 8 ", 1, 200)).toBe(8);
  for (const mauvais of [undefined, "", "  ", "abc", "99", "3", null]) expect(reglageNumerique(mauvais, 10, 22)).toBeNull();
  expect(reglageNumerique("0", 1, 200)).toBeNull();
  const src = lire("src/lib/carte3d.js");
  expect(src).toContain("process.env.NEXT_PUBLIC_CARTE_3D_PHOTO_ZOOM_MAX");
  expect(src).toContain("process.env.NEXT_PUBLIC_CARTE_3D_PHOTO_ERREUR_ECRAN");
});

test("zone de mesures : zoom actuel et erreur géométrique la plus fine parmi les tuiles affichées", async () => {
  const { erreurGeometriqueLaPlusFine, creerMesures } = await import("../../src/lib/carte3dPhoto.js");
  const tuiles = [
    { content: {}, lodMetricValue: 131489 },
    { content: {}, lodMetricValue: 32.5 },
    { content: {}, lodMetricValue: 8 },
    { content: null, lodMetricValue: 1 }, // sans contenu : ignorée
    { content: {}, lodMetricValue: 1e100 }, // infinie : ignorée
    { content: {}, header: { geometricError: 16 } },
  ];
  expect(erreurGeometriqueLaPlusFine(tuiles)).toBe(8);
  expect(erreurGeometriqueLaPlusFine([])).toBeNull();
  expect(erreurGeometriqueLaPlusFine(null)).toBeNull();
  const m = creerMesures(() => 0);
  m.erreurFine(8);
  expect(m.donnees().erreurFine).toBe(8);
  const carte = lire("src/components/Carte3D.jsx");
  expect(carte).toContain("Zoom : ");
  expect(carte).toContain("Erreur géométrique la plus fine affichée");
  expect(carte).toContain('carte.on("zoom", maj)');
  expect(lire("src/lib/carte3dPhoto.js")).toContain("mesures.erreurFine(erreurGeometriqueLaPlusFine(tuilesChoisies))");
});

test("toutes les voies de zoom passent par le zoom maximal de la carte (molette, pincement, double clic, clavier, vol vers une boutique)", async () => {
  const carte = lire("src/components/Carte3D.jsx");
  // MapLibre borne TOUT mouvement de caméra par maxZoom (setMaxZoom) ; nos propres déplacements le respectent aussi
  expect(carte).toContain("carte.setMaxZoom(profil.zoomMax)");
  expect(carte).toContain("Math.min(Math.max(carteRef.current.getZoom(), 16), carteRef.current.getMaxZoom())"); // bande de boutiques (vol)
  expect(carte).toContain("carte.setMaxZoom(22)"); // restauré en quittant la vue photo
  // les seuls zooms écrits « en dur » sont ceux du démarrage (hors vue photo) et ceux bornés ci-dessus
  const enDur = (carte.match(/(?<![a-zA-Z])zoom: [0-9.]+/g) || []).map((x) => x.trim());
  expect(enDur).toEqual(["zoom: 15.2"]);
});

test("garde-fou de zoom : fitBounds n'est pas borné par MapLibre, la vue photo ramène le zoom au maximum", async () => {
  const carte = lire("src/components/Carte3D.jsx");
  expect(carte).toContain("if (carte.getZoom() > max + 0.01) carte.jumpTo({ zoom: max });");
  expect(carte).toContain('carte.on("zoomend", borner)');
  expect(carte).toContain('carte.off("zoomend", borner)');
});

// Boîte orientée locale (est, nord, verticale), centrée à `haut` m au-dessus de l'ellipsoïde, demi-axe vertical `demiVertical`.
function boiteFine(lieu, p0, haut, demiVertical) {
  const la = (lieu.lat * Math.PI) / 180, lo = (lieu.lng * Math.PI) / 180;
  const est = [-Math.sin(lo), Math.cos(lo), 0];
  const nord = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
  const h3 = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  const c = p0.map((v, i) => v + haut * h3[i]);
  return { box: [...c, ...est.map((v) => v * 1000), ...nord.map((v) => v * 1000), ...h3.map((v) => v * demiVertical)] };
}

test("ancrage des épingles : hauteur du sol lue dans les boîtes des tuiles affichées (la plus fine), repli à 0 m", async () => {
  const { hauteurSolSousPoint, altitudeAncrage, BORNES_HAUTEUR_SOL_M } = await import("../../src/lib/hauteurSol.js");
  const { versEcef } = await import("../../src/lib/couvertureTuiles3d.js");
  const lieu = { lat: 14.7557, lng: -17.3843 };
  const p0 = versEcef(lieu.lat, lieu.lng);
  const tuile = (haut, demi, ge, extra = {}) => ({ content: {}, lodMetricValue: ge, header: { boundingVolume: boiteFine(lieu, p0, haut, demi) }, computedTransform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], ...extra });
  const grossiere = tuile(60, 60, 100); // sol de 0 à 120 m
  const fine = tuile(30, 12, 8); // sol de 18 à 42 m
  const lecture = hauteurSolSousPoint([grossiere, fine], lieu);
  expect(lecture.ge).toBe(8); // la tuile la plus fine l'emporte
  expect(lecture.bas).toBeCloseTo(18, 1);
  expect(lecture.haut).toBeCloseTo(42, 1);
  expect(altitudeAncrage(lecture, 52)).toBeCloseTo(18 - 52, 1); // dans la scène : le décalage vertical des tuiles est retranché
  // tuiles ignorées : sans contenu, sans boîte, erreur infinie, boîte ailleurs
  const loin = { content: {}, lodMetricValue: 1, header: { boundingVolume: boiteFine({ lat: 14.9, lng: -17.1 }, versEcef(14.9, -17.1), 30, 12) } };
  expect(hauteurSolSousPoint([tuile(30, 12, 8, { content: null }), tuile(30, 12, 8, { header: {} }), tuile(30, 12, 1e100), loin], lieu)).toBeNull();
  expect(hauteurSolSousPoint([], lieu)).toBeNull();
  expect(hauteurSolSousPoint(null, lieu)).toBeNull();
  expect(altitudeAncrage(null, 52)).toBeNull(); // l'appelant retombe sur 0 m
  // hauteurs hors de la fenêtre du test de couverture (-50..400 m) : la plage de lecture est plus large
  expect(BORNES_HAUTEUR_SOL_M[0]).toBeLessThan(-50);
  expect(BORNES_HAUTEUR_SOL_M[1]).toBeGreaterThan(400);
  const haute = hauteurSolSousPoint([tuile(900, 40, 4)], lieu);
  expect(haute.bas).toBeCloseTo(860, 0);
});

test("épingles de la vue photo : calque dédié, position image par image, hauteur lue affichée", async () => {
  const carte = lire("src/components/Carte3D.jsx");
  expect(carte).toContain("const placerPins = useCallback");
  expect(carte).toContain('carte.on("render", placerPins)');
  expect(carte).toContain("hauteursRef.current.get(e.id)?.altitude ?? 0"); // repli : 0 m
  expect(carte).toContain("ctl.projeter(points)");
  expect(carte).toContain("photoRef.current.definirLieux(");
  expect(carte).toContain("Hauteur du sol lue sous");
  // vue grise : toujours des repères MapLibre (ml.Marker) ; vue photo : éléments simples dans le calque
  expect(carte).toContain('new ml.Marker({ element: el, anchor: "top-left", offset: [-70, -85] }).setLngLat([e.lng, e.lat]).addTo(carte);');
  expect(carte).toContain("conteneurPinsRef.current.appendChild(el)");
  const photo = lire("src/lib/carte3dPhoto.js");
  expect(photo).toContain("WebMercatorViewport");
  expect(photo).toContain("definirLieux");
  expect(photo).toContain("hauteurSolSousPoint(dernieresTuiles, l)");
  expect(photo).toContain("traiterTuiles(tuilesChoisies)");
  expect(photo).toContain("lecture.ge <= ancienne.ge"); // lecture la plus fine conservée : pas de saut quand une tuile quitte la sélection
  expect(carte).not.toContain("DECALAGE_VERTICAL_PHOTO_M ="); // la constante reste dans carte3d.js
});

test("images de la carte 3D : produits et logos passent par le Worker (cache long) ; privées, signées et externes ne sont jamais touchées", async () => {
  const { adresseImage, lireHote } = await import("../../src/lib/imagesPubliques.js");
  const HOTE = "https://facilite-images.facilitefacile62.workers.dev";
  const PROJET = "https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object";
  // images publiques du bucket des photos de la boutique : réécrites vers le Worker
  expect(adresseImage(`${PROJET}/public/marketplace-photos/vendeur/1788619568081-photo.jpg`, HOTE)).toBe(`${HOTE}/marketplace-photos/vendeur/1788619568081-photo.jpg`);
  expect(adresseImage(`${PROJET}/public/marketplace-photos/vendeur/logo-1793697532943.jpg`, HOTE)).toBe(`${HOTE}/marketplace-photos/vendeur/logo-1793697532943.jpg`);
  // images signées (jeton) ou de buckets privés (avatars, covers, documents) : jamais réécrites
  expect(adresseImage(`${PROJET}/sign/marketplace-photos/vendeur/x.jpg?token=abc`, HOTE)).toBe(`${PROJET}/sign/marketplace-photos/vendeur/x.jpg?token=abc`);
  expect(adresseImage(`${PROJET}/public/avatars/u/a.jpg`, HOTE)).toBe(`${PROJET}/public/avatars/u/a.jpg`);
  expect(adresseImage(`${PROJET}/authenticated/marketplace-photos/u/x.jpg`, HOTE)).toBe(`${PROJET}/authenticated/marketplace-photos/u/x.jpg`);
  // autre projet Supabase, image externe, image intégrée : inchangées
  expect(adresseImage("https://autreprojet.supabase.co/storage/v1/object/public/marketplace-photos/u/x.jpg", HOTE)).toBe("https://autreprojet.supabase.co/storage/v1/object/public/marketplace-photos/u/x.jpg");
  expect(adresseImage("https://images.unsplash.com/photo-1", HOTE)).toBe("https://images.unsplash.com/photo-1");
  expect(adresseImage("data:image/png;base64,AAAA", HOTE)).toBe("data:image/png;base64,AAAA");
  // interrupteur fermé (variable absente ou invalide) : adresse inchangée
  expect(adresseImage(`${PROJET}/public/marketplace-photos/vendeur/x.jpg`, "")).toBe(`${PROJET}/public/marketplace-photos/vendeur/x.jpg`);
  expect(lireHote("http://pas-https.exemple")).toBe("");
  const carte = lire("src/components/Carte3D.jsx");
  expect(carte).toContain('import { adresseImage } from "@/lib/imagesPubliques";');
  expect(carte).toContain("adresseImage(urlPhoto(a.photos[0]))");
  expect(carte).toContain("echapperHtml(adresseImage(b.logo_url))");
  // AFFICHAGE seulement : aucune écriture en base dans la carte 3D
  expect(carte).not.toMatch(/\.(insert|update|upsert|delete)\(|supabase\.rpc/);
});

test("vue grise : plus de bulles empilées ; le carrousel de la boutique touchée s'ouvre dans le panneau fixe, devant les autres, jamais sous la recherche", async () => {
  const carte = lire("src/components/Carte3D.jsx");
  // aucune bulle MapLibre dans la carte (ni grise ni photo)
  expect(carte).not.toContain("new ml.Popup");
  expect(carte).not.toContain("popup.addTo");
  expect(carte).not.toContain("crees.forEach((r) => r.popup");
  // clic sur une épingle grise : panneau fixe si la touche « Carrousel » est active ; l'épingle touchée passe devant ; le clic ne ferme pas le panneau
  expect(carte).toContain("reperesRef.current.set(e.id, el);");
  expect(carte).toContain("ev.stopPropagation()");
  expect(carte).toContain("if (enPhoto || carrousel) setPanneau({ boutiques: [e.b], index: 0 });");
  expect(carte).toContain("}, [panneau, visibles, photo]);"); // z-index 10 de l'épingle choisie, aussi quand la liste change
  // le panneau fixe est affiché dans les deux vues et se ferme par la croix ou un clic sur la carte (deux vues)
  expect(carte).toContain("{panneau && boutiqueDuPanneau && (");
  expect(carte).not.toContain('{photo === "on" && panneau && boutiqueDuPanneau');
  expect(carte).toContain("if (etat !== \"pret\" || !carte) return undefined;");
  expect(carte).toContain("const fermer = () => setPanneau(null);");
  // touche « Carrousel » éteinte (vue grise) : le panneau se ferme ; la bande de boutiques ouvre le carrousel de la boutique (vue grise seulement)
  expect(carte).toContain('if (carrousel && photo !== "on") setPanneau(null);');
  expect(carte).toContain('if (photo !== "on" && carrousel) setPanneau({ boutiques: [b], index: 0 });');
  // le panneau est au-dessus de la bande de boutiques (même colonne), donc sous la recherche : hauteur limitée à 42 % de l'écran
  expect(carte).toContain('maxHeight: "42vh"');
  // vue photo : le chemin des épingles reste celui de l'ancrage (calque dédié)
  expect(carte).toContain("conteneurPinsRef.current.appendChild(el)");
  expect(carte).toContain("photoRef.current.definirLieux(");
});

test("vue grise : la mention OpenFreeMap / OpenStreetMap n'est jamais cachée par le panneau (obligation de licence)", async () => {
  const carte = lire("src/components/Carte3D.jsx");
  expect(carte).toContain(".maplibregl-ctrl-bottom-right{bottom:var(--bas-attribution,104px) !important}");
  expect(carte).toContain("const panneauOuvertGris = Boolean(panneau) && photo !== \"on\";");
  expect(carte).toContain("window.innerHeight - el.getBoundingClientRect().top + 8"); // juste au-dessus du panneau
  expect(carte).toContain("ref={dialogueRef}");
  expect(carte).toContain('"--bas-attribution": `${basAttribution}px`');
  expect(carte).toContain("new ResizeObserver(mesurer)"); // suit la taille du panneau (carrousel qui se charge)
  expect(carte).toContain('window.addEventListener("resize", mesurer)');
  // la mention reste affichée en vue grise (contrôle d'attribution MapLibre) et n'est masquée qu'en vue photo (fond remplacé par la photo)
  expect(carte).toContain("ATTRIBUTION_BATIMENTS");
  expect(carte).toContain(".carte-photo .maplibregl-ctrl-bottom-right{display:none}");
});

test("placement anti-chevauchement dans la carte : une épingle par boutique, point + trait sur le vrai emplacement, recalcul à l'arrêt du mouvement, zones interdites", async () => {
  const carte = lire("src/components/Carte3D.jsx");
  // plus aucun regroupement
  expect(carte).not.toContain("groupesBoutiques");
  expect(carte).not.toContain("elementRepereGroupe");
  expect(carte).not.toContain("boutiques\`");
  expect(fs.existsSync(path.join(__dirname, "..", "..", "src/lib/groupesBoutiques.js"))).toBe(false);
  expect(carte).toContain('import { placerEpingles, selectionnerVisibles } from "@/lib/ecartementEpingles";');
  // point + trait sur le vrai emplacement (élément d'ancre), décalage en pixels appliqué au repère de l'épingle
  expect(carte).toContain("function elementAncre()");
  expect(carte).toContain("majAncre(e.ancreEl, d.dx, d.dy);");
  expect(carte).toContain("e.marqueurPin.setOffset([-70 + d.dx, -85 + d.dy]);");
  // vue photo : l'écartement est dans le plan de l'écran, la hauteur du sol lue est conservée pour le point
  expect(carte).toContain("(x - 70 + (e.dx || 0))");
  expect(carte).toContain("e.ancreEl.style.transform = `translate(");
  expect(carte).toContain("hauteursRef.current.get(e.id)?.altitude ?? 0");
  // recalcul quand la carte s'arrête (pas à chaque image), à la taille de la fenêtre, à l'ouverture du panneau et quand la hauteur du sol change
  expect(carte).toContain('carte.on("moveend", surMouvement);');
  expect(carte).toContain('window.addEventListener("resize", surTaille);');
  expect(carte).toContain("planifierPlacement(250);");
  expect(carte).toContain("planifierPlacement(200);");
  // zones interdites : recherche + filtres, panneau + bande de boutiques, boutons 3D / PHOTO
  expect((carte.match(/data-zone-interdite="1"/g) || []).length).toBeGreaterThanOrEqual(4);
  expect(carte).toContain('racine.querySelectorAll("[data-zone-interdite]")');
});

test("plafond de boutiques affichées : réglable par variable (150 par défaut), avis jamais silencieux", async () => {
  const { PLAFOND_BOUTIQUES, reglageNumerique } = await import("../../src/lib/carte3d.js");
  expect(PLAFOND_BOUTIQUES).toBe(150);
  expect(reglageNumerique("300", 1, 2000)).toBe(300);
  expect(reglageNumerique("0", 1, 2000)).toBeNull();
  expect(reglageNumerique("9999", 1, 2000)).toBeNull();
  expect(lire("src/lib/carte3d.js")).toContain("process.env.NEXT_PUBLIC_CARTE_3D_PLAFOND_BOUTIQUES");
  const carte = lire("src/components/Carte3D.jsx");
  expect(carte).toContain("selectionnerVisibles(positions, { plafond: PLAFOND_BOUTIQUES");
  expect(carte).toContain("les ${sel.retenues.size} plus utiles (en stock d'abord) sont affichées. Zoomez pour voir les autres.");
  expect(carte).toContain("{avisPlafond && (");
  // la bande de boutiques et le panneau ne changent pas : la bande liste toutes les boutiques filtrées
  expect(carte).toContain("{affichees.map((b) => (");
});

test("touches : seule la goutte de l'épingle reçoit les clics (les boîtes voisines écartées ne se recouvrent pas)", async () => {
  const carte = lire("src/components/Carte3D.jsx");
  expect(carte).toContain('boite.style.cssText = "width:140px;height:90px;cursor:pointer;pointer-events:none;";');
  expect(carte).toContain('const pin = boite.querySelector(".epingle-pin");');
  expect(carte).toContain('if (pin) pin.style.pointerEvents = "auto";');
  expect(carte).toContain("will-change:transform;z-index:1;");
  expect(carte).not.toContain('querySelector(".epingle-boite").style.pointerEvents = "auto"');
  const epingle = lire("src/lib/epingleCarte.js");
  expect(epingle).toContain('class="epingle-pin"'); // la goutte porte la classe et reste cliquable (pointer-events:auto dans son style)
});

test("zones interdites du site : bouton vert « + » (~90 × 90 px, coin bas droit) et tout élément du site superposé à la carte", async () => {
  const carte = lire("src/components/Carte3D.jsx");
  // éléments du site en position fixe, au-dessus de la carte, hors de notre composant
  expect(carte).toContain(`document.querySelectorAll(".fixed, [style*='position: fixed'], [style*='position:fixed']")`);
  expect(carte).toContain("if (racine.contains(el)) return;");
  expect(carte).toContain("if (!(Number.parseInt(st.zIndex, 10) >= 50)) return;");
  expect(carte).toContain("interdits.push({ x0: r.left - rr.left - 13, y0: r.top - rr.top - 13, x1: r.right - rr.left + 13, y1: r.bottom - rr.top + 13 });");
  // repli fixe : coin bas droit de 100 × 90 px (bouton de 64 px à 128 px du bas)
  expect(carte).toContain("interdits.push({ x0: racine.clientWidth - 100, y0: racine.clientHeight - 205, x1: racine.clientWidth, y1: racine.clientHeight - 115 });");
  // le bouton du site existe bien avec ces caractéristiques (si elles changent, ce test le signale)
  const bouton = lire("src/components/BoutonFlottantFacilite.jsx");
  expect(bouton).toContain("fixed bottom-32 right-4");
  expect(bouton).toContain("z-[999]");
  expect(bouton).toContain("w-16 h-16");
});
