const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Application : les cartes et les ronds téléchargent la variante 480 ou 960 px des affiches et des stories (au lieu des 1280 px), avec repli sur l'original.
 * Même convention de nommage que le site (src/lib/variantesImage.js) : « <nom>-w1280.webp » → « <nom>-w480.webp » / « <nom>-w960.webp ».
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");
const logique = () => import("../../mobile/src/lib/variantesImageLogique.ts");

test.describe("urlVarianteImage", () => {
  const base = "https://x.supabase.co/storage/v1/object/public/job-offers/admin-posters/poster-1";
  test("une image « -w1280.webp » a ses variantes 480 et 960", async () => {
    const { urlVarianteImage } = await logique();
    expect(urlVarianteImage(`${base}-w1280.webp`, 480)).toBe(`${base}-w480.webp`);
    expect(urlVarianteImage(`${base}-w1280.webp`, 960)).toBe(`${base}-w960.webp`);
  });
  test("paramètres d'adresse conservés ; majuscules acceptées", async () => {
    const { urlVarianteImage } = await logique();
    expect(urlVarianteImage(`${base}-w1280.webp?v=2`, 480)).toBe(`${base}-w480.webp?v=2`);
    expect(urlVarianteImage(`${base}-W1280.WEBP`, 960)).toBe(`${base}-w960.webp`);
  });
  test("toute autre adresse reste intacte : pas de variantes, aucun risque de 404", async () => {
    const { urlVarianteImage } = await logique();
    for (const u of [`${base}.jpg`, `${base}-w480.webp`, "https://ffacilite.com/seterimage.avif", "data:image/png;base64,AAAA", ""]) expect(urlVarianteImage(u, 480)).toBe(u);
  });
  test("sans largeur demandée : adresse d'origine", async () => {
    const { urlVarianteImage } = await logique();
    expect(urlVarianteImage(`${base}-w1280.webp`)).toBe(`${base}-w1280.webp`);
  });
});

test.describe("branchement dans l'application", () => {
  test("ImageVariante : repli UNE fois sur l'original si la variante échoue, sans variante sans `largeur`", () => {
    const c = lire("mobile/src/components/ImageVariante.tsx");
    expect(c).toContain("urlVarianteImage(uri, largeur)");
    expect(c).toContain("if (adresse !== uri) setRepliPour(uri);");
    expect(c).toContain("else onError?.(e);");
  });
  test("cartes d'offres : affiche en 960 et logo sur la MÊME adresse 960 (un seul téléchargement partagé par le cache)", () => {
    const c = lire("mobile/src/components/CarteOffre.tsx");
    expect(c).toContain("largeur={960}");
    expect(c).toContain("largeurImage={960}");
  });
  test("vignettes et ronds : 480 px (recherche, accueil, bandeau, avatar de la visionneuse, carte Autour)", () => {
    for (const [f, motif] of [
      ["mobile/src/app/recherche.tsx", "uri={resultat.posterUri}\n          largeur={480}"],
      ["mobile/src/components/FaciliteHeader.tsx", "<ImageVariante uri={s.imageUrl} largeur={480}"],
      ["mobile/src/app/(tabs)/index.tsx", "<ImageVariante uri={st.imageUrl} largeur={480}"],
      ["mobile/src/components/StoryViewer.tsx", "<ImageVariante uri={story.imageUrl} largeur={480}"],
      ["mobile/src/app/(tabs)/autour.tsx", "<ImageVariante uri={item.affiche} largeur={480}"],
    ]) expect(lire(f), f).toContain(motif);
  });
  test("la page de détail, la visionneuse plein écran et la story en grand gardent l'image d'origine", () => {
    expect(lire("mobile/src/app/offre/[id].tsx")).not.toContain("largeurImage");
    const v = lire("mobile/src/components/OfferMediaView.tsx");
    expect(v).toContain("source={{ uri: images[lightboxIndex] }}");
    expect(lire("mobile/src/components/StoryViewer.tsx")).toContain("source={{ uri: story.imageUrl }} alt={story.titre}");
  });
});
