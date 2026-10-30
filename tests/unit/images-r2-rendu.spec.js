const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const React = require("react");
const { renderToString } = require("react-dom/server");

/**
 * Rendu serveur RÉEL (React 19, comme le HTML envoyé par Vercel) des composants d'affichage d'images, interrupteur ouvert puis fermé :
 * quand l'interrupteur est ouvert, AUCUNE adresse Supabase des 3 buckets publics ne doit rester dans le HTML rendu, préchargements (<link rel="preload" as="image">) compris.
 * Les composants sont transpilés (JSX → JS) puis exécutés ; l'alias « @/ » pointe sur src/.
 */
const racine = path.join(__dirname, "../..");
const lire = (p) => fs.readFileSync(path.join(racine, p), "utf8").replace(/\r\n/g, "\n");
const HOTE = "https://facilite-images.ffacilite.workers.dev";
const REF = "ocfhzwwjvljintabxxlg";
const SB = `https://${REF}.supabase.co/storage/v1/object/public`;
const SUPABASE_3_BUCKETS = new RegExp(`${REF}\\.supabase\\.co/storage/v1/object/public/(job-offers|marketplace-photos|stories-media)/`);

function chargeur(hote) {
  const ancien = process.env.NEXT_PUBLIC_IMAGES_HOTE;
  process.env.NEXT_PUBLIC_IMAGES_HOTE = hote;
  const cache = new Map();
  const EXT = ["", ".js", ".jsx", ".mjs", "/index.js"];
  const resoudre = (base, nom) => {
    const brut = nom.startsWith("@/") ? path.join(racine, "src", nom.slice(2)) : path.resolve(path.dirname(base), nom);
    for (const e of EXT) if (fs.existsSync(brut + e) && fs.statSync(brut + e).isFile()) return brut + e;
    throw new Error("introuvable : " + nom);
  };
  const charger = (fichier) => {
    if (cache.has(fichier)) return cache.get(fichier).exports;
    const module_ = { exports: {} };
    cache.set(fichier, module_);
    const code = ts.transpileModule(fs.readFileSync(fichier, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
    const exigence = (nom) => (nom === "react" ? React : nom.startsWith("@/") || nom.startsWith(".") ? charger(resoudre(fichier, nom)) : require(nom));
    new Function("exports", "require", "module", "React", code)(module_.exports, exigence, module_, React);
    return module_.exports;
  };
  return {
    composant: (rel) => charger(path.join(racine, rel)).default,
    fin: () => {
      if (ancien === undefined) delete process.env.NEXT_PUBLIC_IMAGES_HOTE;
      else process.env.NEXT_PUBLIC_IMAGES_HOTE = ancien;
    },
  };
}
/** Rend un composant dans un document complet (pour que les préchargements soient émis dans <head>, comme en production). */
function rendre(hote, rel, props) {
  const c = chargeur(hote);
  try {
    const Composant = c.composant(rel);
    return renderToString(React.createElement("html", null, React.createElement("head", null), React.createElement("body", null, React.createElement(Composant, props))));
  } finally {
    c.fin();
  }
}
const preloads = (html) => html.replace(/></g, ">\n<").split("\n").filter((l) => l.startsWith("<link") && l.includes('rel="preload"'));

const MEDIA_LISTES = [
  `${SB}/job-offers/admin-posters/poster-1-w1280.webp`,
  `${SB}/job-offers/uuid/admin-offers-1790383561176-0.jpeg`,
  `${SB}/job-offers/sen_interim_appel_candidature-w1280.webp`,
];

test.describe("rendu serveur réel : galerie d'affiches", () => {
  test("interrupteur OUVERT : aucune adresse Supabase des 3 buckets dans le HTML (affiches, vignettes, srcset, préchargements)", () => {
    const html = rendre(HOTE, "src/components/OfferMediaGallery.jsx", { media: MEDIA_LISTES, loadingCouverture: "eager" });
    expect(html).not.toMatch(SUPABASE_3_BUCKETS);
    expect(html).toContain(`${HOTE}/job-offers/admin-posters/poster-1-w1280.webp`);
    expect(html).toContain(`${HOTE}/job-offers/admin-posters/poster-1-w480.webp 480w`);
    const liens = preloads(html);
    expect(liens.length).toBeGreaterThan(0);
    for (const l of liens) expect(l).not.toMatch(SUPABASE_3_BUCKETS);
    expect(liens.some((l) => l.includes(HOTE))).toBe(true);
  });
  test("interrupteur OUVERT : une seule affiche donnée comme texte JSON ou avec séparateurs « ||| » est aussi remplacée", () => {
    for (const media of [JSON.stringify(MEDIA_LISTES), MEDIA_LISTES.join("|||"), MEDIA_LISTES[0]]) {
      const html = rendre(HOTE, "src/components/OfferMediaGallery.jsx", { media, loadingCouverture: "eager" });
      expect(html, String(media).slice(0, 40)).not.toMatch(SUPABASE_3_BUCKETS);
      expect(html).toContain(HOTE);
    }
  });
  test("interrupteur FERMÉ (variable absente, vide ou invalide) : HTML identique octet pour octet, adresses Supabase d'origine, aucune adresse du Worker", () => {
    const ferme = rendre("", "src/components/OfferMediaGallery.jsx", { media: MEDIA_LISTES, loadingCouverture: "eager" });
    expect(ferme).toMatch(SUPABASE_3_BUCKETS);
    expect(ferme).not.toContain("workers.dev");
    for (const invalide of ["http://insecure.example", "https://x.example/chemin", "pas une adresse"]) {
      expect(rendre(invalide, "src/components/OfferMediaGallery.jsx", { media: MEDIA_LISTES, loadingCouverture: "eager" })).toBe(ferme);
    }
  });
  test("jamais remplacées, même ouvert : avatars, covers et images du dépôt", () => {
    const html = rendre(HOTE, "src/components/OfferMediaGallery.jsx", { media: [`${SB}/avatars/u/photo.jpg`, `${SB}/covers/u/c.jpg`, "/affiche_cv_pro.jpg"], loadingCouverture: "eager" });
    expect(html).toContain(`${SB}/avatars/u/photo.jpg`);
    expect(html).toContain(`${SB}/covers/u/c.jpg`);
    expect(html).toContain("/affiche_cv_pro.jpg");
    expect(html).not.toContain("workers.dev");
  });
});

test.describe("rendu serveur réel : image adaptative et stories", () => {
  test("ImageAdaptative : src et srcset du Worker quand ouvert ; Supabase quand fermé", () => {
    const url = `${SB}/job-offers/admin-posters/a-w1280.webp`;
    const ouvert = rendre(HOTE, "src/components/ImageAdaptative.jsx", { src: url, alt: "x" });
    expect(ouvert).not.toMatch(SUPABASE_3_BUCKETS);
    expect(ouvert).toContain(`src="${HOTE}/job-offers/admin-posters/a-w1280.webp"`);
    expect(ouvert).toContain(`${HOTE}/job-offers/admin-posters/a-w960.webp 960w`);
    const ferme = rendre("", "src/components/ImageAdaptative.jsx", { src: url, alt: "x" });
    expect(ferme).toContain(`src="${url}"`);
    expect(ferme).not.toContain("workers.dev");
  });
  test("StoryViewer : image et avatar de la story passent par le Worker quand ouvert", () => {
    const stories = [{ id: "s1", titre: "Titre", image_url: `${SB}/stories-media/s/x-w1280.webp`, libelle_bouton: null, lien: null, bouton_visible: false, created_at: new Date().toISOString() }];
    const ouvert = rendre(HOTE, "src/components/StoryViewer.jsx", { stories, debut: 0, onClose: () => {} });
    expect(ouvert).not.toMatch(SUPABASE_3_BUCKETS);
    expect(ouvert).toContain(`${HOTE}/stories-media/s/x-w1280.webp`);
    const ferme = rendre("", "src/components/StoryViewer.jsx", { stories, debut: 0, onClose: () => {} });
    expect(ferme).toMatch(SUPABASE_3_BUCKETS);
  });
});

test.describe("accueil et page Offres : chaque image venant d'une offre passe par l'aide d'adresse", () => {
  // Toutes les expressions src={...} des deux grands écrans (multi-lignes comprises) : soit enveloppées par adresseImage(), soit dans la liste des sources
  // qui ne viennent d'aucun des 3 buckets (photo de profil, notification, image statique du dépôt).
  const AUTORISEES = [/userProfile\??\.avatar_url/, /notif\.avatar/, /tpl\.previewUrl/, /^"\/[^"]*"$/];
  for (const fichier of ["src/app/HomeClient.jsx", "src/app/offres/OffresClient.jsx"]) {
    test(`${fichier} : aucune source d'image d'offre sans adresseImage()`, () => {
      const code = lire(fichier);
      const expressions = [...code.matchAll(/\bsrc=\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g)].map((m) => m[1].trim());
      // Garde-fou du test lui-même : l'extraction doit bien trouver les sources connues (accueil : 7, page Offres : 2).
      expect(expressions.length).toBeGreaterThanOrEqual(fichier.endsWith("HomeClient.jsx") ? 7 : 2);
      const fautives = expressions.filter((e) => !e.includes("adresseImage(") && !AUTORISEES.some((r) => r.test(e)) && e !== "offerImg");
      expect(fautives).toEqual([]);
    });
  }
  test("OffresClient : offerImg est construit avec adresseImage()", () => {
    expect(lire("src/app/offres/OffresClient.jsx")).toContain("const offerImg = adresseImage(getOfferImage(offer, idx));");
  });
  test("accueil : l'avatar des cartes (affiche de l'offre) et la visionneuse sont couverts ; les DONNÉES des offres gardent leur adresse Supabase", () => {
    const code = lire("src/app/HomeClient.jsx");
    expect(code).toContain("{...proprietesAvatar(job.logo)}");
    expect(code).toContain("src={adresseImage(viewImageModal.url)}");
    expect(code).not.toMatch(/(logo|image|image_url):\s*adresseImage/);
    expect(code).not.toMatch(/src=\{job\.logo\}|src=\{viewImageModal\.url\}/);
  });
});
