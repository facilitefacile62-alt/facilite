const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Images publiques du site par le Worker Cloudflare : interrupteur NEXT_PUBLIC_IMAGES_HOTE, remplacement À L'AFFICHAGE seulement, repli automatique sur Supabase,
 * politique de sécurité. Interrupteur fermé = comportement exactement identique à avant.
 */
const racine = path.join(__dirname, "../..");
const lire = (p) => fs.readFileSync(path.join(racine, p), "utf8").replace(/\r\n/g, "\n");
const lib = () => import("../../src/lib/imagesPubliques.js");
const REF = "ocfhzwwjvljintabxxlg";
const SB = `https://${REF}.supabase.co/storage/v1/object/public`;
const HOTE = "https://facilite-images.ffacilite.workers.dev";

test.describe("adresseImage : interrupteur et périmètre", () => {
  test("interrupteur FERMÉ (hôte absent ou invalide) : toutes les entrées sont rendues inchangées", async () => {
    const { adresseImage, adresseSupabase, imagesWorkerActives, lireHote } = await lib();
    const url = `${SB}/job-offers/a-w1280.webp`;
    for (const hote of ["", undefined, null, "http://insecure.example", "https://x.example/chemin", "javascript:alert(1)", "facilite-images.workers.dev", "https://", "https://exemple.com:8080"]) {
      expect(lireHote(hote), String(hote)).toBe("");
      expect(adresseImage(url, hote)).toBe(url);
      expect(adresseSupabase(`${HOTE}/job-offers/a.webp`, hote)).toBe(`${HOTE}/job-offers/a.webp`);
      expect(imagesWorkerActives(hote)).toBe(false);
    }
  });
  test("interrupteur ouvert : les 3 buckets publics du projet de production passent par le Worker, chemin et paramètres conservés", async () => {
    const { adresseImage } = await lib();
    expect(adresseImage(`${SB}/job-offers/admin-posters/a-w1280.webp`, HOTE)).toBe(`${HOTE}/job-offers/admin-posters/a-w1280.webp`);
    expect(adresseImage(`${SB}/marketplace-photos/u/p.png?v=2`, HOTE)).toBe(`${HOTE}/marketplace-photos/u/p.png?v=2`);
    expect(adresseImage(`${SB}/stories-media/s%20x.jpg`, HOTE)).toBe(`${HOTE}/stories-media/s%20x.jpg`);
    expect(adresseImage(`${SB}/job-offers/a.webp`, `${HOTE}/`)).toBe(`${HOTE}/job-offers/a.webp`);
  });
  test("jamais touchés : avatars, covers, banque-cv et autres buckets, autre projet Supabase, autres sites, chemins relatifs, valeurs vides", async () => {
    const { adresseImage } = await lib();
    for (const u of [
      `${SB}/avatars/u/photo.jpg`,
      `${SB}/covers/u/c.jpg`,
      `${SB}/banque-cv/u/cv.pdf`,
      `${SB}/resumes/u/cv.pdf`,
      "https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/job-offers/a.webp",
      "https://images.unsplash.com/photo.jpg",
      "/affiche_cv_pro.jpg",
      "",
    ]) expect(adresseImage(u, HOTE)).toBe(u);
    expect(adresseImage(null, HOTE)).toBeNull();
    expect(adresseImage(undefined, HOTE)).toBeUndefined();
    expect(adresseImage(42, HOTE)).toBe(42);
  });
  test("listes : tableau, liste JSON et séparateurs « ||| » (champ image_url à plusieurs affiches) ; idempotent", async () => {
    const { adresseImage } = await lib();
    const a = `${SB}/job-offers/a-w1280.webp`;
    const b = `${SB}/job-offers/b.jpg`;
    const w = (x) => x.replace(`${SB}/`, `${HOTE}/`);
    expect(adresseImage([a, b], HOTE)).toEqual([w(a), w(b)]);
    expect(adresseImage(JSON.stringify([a, b]), HOTE)).toBe(JSON.stringify([w(a), w(b)]));
    expect(adresseImage(`${a}|||${b}`, HOTE)).toBe(`${w(a)}|||${w(b)}`);
    expect(adresseImage(adresseImage(a, HOTE), HOTE)).toBe(w(a));
  });
  test("adresseSupabase est l'inverse exact (aller-retour) et ne touche pas aux autres adresses", async () => {
    const { adresseImage, adresseSupabase } = await lib();
    const a = `${SB}/stories-media/x-w1280.webp`;
    expect(adresseSupabase(adresseImage(a, HOTE), HOTE)).toBe(a);
    expect(adresseSupabase("https://autre.example/job-offers/x.png", HOTE)).toBe("https://autre.example/job-offers/x.png");
    expect(adresseSupabase(`${HOTE}/avatars/x.png`, HOTE)).toBe(`${HOTE}/avatars/x.png`);
  });
});

/** Faux élément du DOM. */
function element(tag, attrs = {}) {
  const el = { tagName: tag, dataset: {}, attrs: { ...attrs }, charges: 0, getAttribute: (n) => (n in el.attrs ? el.attrs[n] : null) };
  Object.defineProperty(el, "src", { get: () => el.attrs.src, set: (v) => (el.attrs.src = v) });
  Object.defineProperty(el, "srcset", { get: () => el.attrs.srcset, set: (v) => (el.attrs.srcset = v) });
  el.load = () => (el.charges += 1);
  return el;
}

test.describe("repli automatique sur Supabase", () => {
  test("image du Worker en échec : src ET srcset remis sur Supabase, une seule fois", async () => {
    const { reparerElement } = await lib();
    const el = element("IMG", { src: `${HOTE}/job-offers/a-w1280.webp`, srcset: `${HOTE}/job-offers/a-w480.webp 480w, ${HOTE}/job-offers/a-w960.webp 960w, ${HOTE}/job-offers/a-w1280.webp 1280w` });
    expect(reparerElement(el, HOTE)).toBe(true);
    expect(el.src).toBe(`${SB}/job-offers/a-w1280.webp`);
    expect(el.srcset).toBe(`${SB}/job-offers/a-w480.webp 480w, ${SB}/job-offers/a-w960.webp 960w, ${SB}/job-offers/a-w1280.webp 1280w`);
    expect(el.dataset.repliSupabase).toBe("1");
    expect(reparerElement(el, HOTE)).toBe(false);
  });
  test("une image qui n'est pas servie par le Worker, ou un interrupteur fermé : rien ne change", async () => {
    const { reparerElement } = await lib();
    const sb = element("IMG", { src: `${SB}/job-offers/a.webp` });
    expect(reparerElement(sb, HOTE)).toBe(false);
    expect(sb.src).toBe(`${SB}/job-offers/a.webp`);
    const w = element("IMG", { src: `${HOTE}/job-offers/a.webp` });
    expect(reparerElement(w, "")).toBe(false);
    expect(w.src).toBe(`${HOTE}/job-offers/a.webp`);
    expect(reparerElement(element("DIV", { src: `${HOTE}/job-offers/a.webp` }), HOTE)).toBe(false);
    expect(reparerElement(null, HOTE)).toBe(false);
  });
  test("audio et source : remis sur Supabase puis rechargés", async () => {
    const { reparerElement } = await lib();
    const audio = element("AUDIO", { src: `${HOTE}/job-offers/u/audio.mp3` });
    expect(reparerElement(audio, HOTE)).toBe(true);
    expect(audio.src).toBe(`${SB}/job-offers/u/audio.mp3`);
    expect(audio.charges).toBe(1);
  });
});

test.describe("branchement dans le site", () => {
  test("affichage seulement : seuls les composants d'affichage importent l'aide ; aucune page qui ENREGISTRE des offres, stories ou boutiques ne l'utilise", () => {
    const attendus = [
      "src/app/HomeClient.jsx",
      "src/app/offres/OffresClient.jsx",
      "src/components/ImageAdaptative.jsx",
      "src/components/ImagesRepliSupabase.jsx",
      "src/components/LecteurAudioOffre.jsx",
      "src/components/OfferMediaGallery.jsx",
      "src/components/StoryViewer.jsx",
    ];
    const trouves = [];
    const parcourir = (dossier) => {
      for (const e of fs.readdirSync(path.join(racine, dossier), { withFileTypes: true })) {
        const rel = `${dossier}/${e.name}`;
        if (e.isDirectory()) parcourir(rel);
        else if (/\.(js|jsx)$/.test(e.name) && /@\/lib\/imagesPubliques/.test(lire(rel))) trouves.push(rel);
      }
    };
    parcourir("src");
    expect(trouves.filter((f) => f !== "src/lib/imagesPubliques.js").sort()).toEqual(attendus);
  });
  test("accueil : les données des offres gardent leurs adresses Supabase ; l'aide n'est appliquée qu'à l'affichage (stories, avatar des cartes, visionneuse)", () => {
    const code = lire("src/app/HomeClient.jsx");
    const lignes = code.split("\n").filter((l) => l.includes("adresseImage(") && !l.includes("import "));
    expect(lignes).toHaveLength(2); // ronds de stories, visionneuse ; l'avatar des cartes passe par proprietesAvatar()
    expect(code).toContain("{...proprietesAvatar(job.logo)}");
    expect(code).not.toMatch(/(logo|image|image_url):\s*adresseImage/);
  });
  test("galerie d'affiches et image adaptative : remplacement à l'affichage, variantes 480/960 construites sur l'adresse du Worker", () => {
    expect(lire("src/components/OfferMediaGallery.jsx")).toContain("parseOfferImages(media).map((u) => adresseImage(u))");
    const ia = lire("src/components/ImageAdaptative.jsx");
    expect(ia).toContain("src={adresseImage(src)}");
    expect(ia).toContain("variantesImage(adresseImage(src))");
  });
  test("lecteur audio : repli sur Supabase en cas d'erreur (un élément Audio créé par script n'est pas vu par le filet global)", () => {
    const code = lire("src/components/LecteurAudioOffre.jsx");
    expect(code).toContain("audio.src = adresseImage(url);");
    expect(code).toContain("if (!repli && adresseImage(url) !== url)");
    expect(code).toContain("audio.src = url;");
  });
  test("filet global : monté dans la mise en page, écoute les erreurs en phase de capture, et seulement si l'interrupteur est ouvert", () => {
    expect(lire("src/app/layout.js")).toContain("<ImagesRepliSupabase />");
    const c = lire("src/components/ImagesRepliSupabase.jsx");
    expect(c).toContain("if (!imagesWorkerActives()) return undefined;");
    expect(c).toContain('document.addEventListener("error", surErreur, true);');
    expect(c).toContain('document.removeEventListener("error", surErreur, true);');
  });
  test("politique de sécurité : l'adresse du Worker n'est ajoutée à img-src et media-src que si l'interrupteur est ouvert et valide", () => {
    const cfg = lire("next.config.mjs");
    expect(cfg).toContain("process.env.NEXT_PUBLIC_IMAGES_HOTE");
    expect(cfg).toContain('const ajoutHoteImages = hoteImages ? ` ${hoteImages}` : "";');
    expect(cfg).toMatch(/img-src [^\n]*arcgisonline\.com" \+ ajoutHoteImages,/);
    expect(cfg).toContain("https://*.supabase.co\" + ajoutHoteImages,");
    // Fermé : aucune autre modification de la politique (img-src garde ses hôtes d'origine).
    expect(cfg).toContain("img-src 'self' data: blob: https://*.supabase.co https://*.googleusercontent.com");
  });
  test("évaluation de la politique : fermée = identique à avant ; ouverte = l'adresse du Worker en plus, dans img-src et media-src seulement", () => {
    const cfg = lire("next.config.mjs");
    const evaluer = (valeur) => {
      const debut = cfg.indexOf('const hoteImagesBrut');
      const fin = cfg.indexOf("const contentSecurityPolicy");
      const bloc = cfg.slice(debut, fin);
      const img = /"(img-src[^"]*)" \+ ajoutHoteImages/.exec(cfg)[1];
      const media = /"(media-src[^"]*)" \+ ajoutHoteImages/.exec(cfg)[1];
      // eslint-disable-next-line no-new-func
      return new Function("process", `${bloc}; return [${JSON.stringify(img)} + ajoutHoteImages, ${JSON.stringify(media)} + ajoutHoteImages];`)({ env: { NEXT_PUBLIC_IMAGES_HOTE: valeur } });
    };
    const [imgFerme, mediaFerme] = evaluer("");
    expect(imgFerme.endsWith("https://server.arcgisonline.com")).toBe(true);
    expect(mediaFerme).toBe("media-src 'self' blob: data: https://*.supabase.co");
    const [imgOuvert, mediaOuvert] = evaluer(HOTE);
    expect(imgOuvert).toBe(`${imgFerme} ${HOTE}`);
    expect(mediaOuvert).toBe(`${mediaFerme} ${HOTE}`);
    expect(evaluer("http://pas-https.example")[0]).toBe(imgFerme);
    expect(evaluer("https://x.example/chemin")[1]).toBe(mediaFerme);
  });
});
