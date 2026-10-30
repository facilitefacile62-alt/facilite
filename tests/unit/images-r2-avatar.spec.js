const { test, expect } = require("@playwright/test");

/**
 * Avatar des cartes de l'accueil : il affiche l'affiche de l'offre dans un rond de 40 px. Interrupteur images-Worker ouvert : variante 480 px + chargement différé ;
 * fermé : exactement comme avant (juste l'adresse d'origine).
 */
const lib = () => import("../../src/lib/imagesPubliques.js");
const SB = "https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public";
const HOTE = "https://facilite-images.ffacilite.workers.dev";

test.describe("proprietesAvatar", () => {
  test("interrupteur fermé : { src } seulement, adresse d'origine, rien d'autre (HTML identique à avant)", async () => {
    const { proprietesAvatar } = await lib();
    const url = `${SB}/job-offers/admin-posters/a-w1280.webp`;
    expect(proprietesAvatar(url, 40, "")).toEqual({ src: url });
    expect(proprietesAvatar(url, 40, "http://insecure.example")).toEqual({ src: url });
  });
  test("ouvert, affiche convertie « -w1280.webp » : adresse du Worker, variantes 480/960/1280 pour un rond de 40 px, chargement différé", async () => {
    const { proprietesAvatar } = await lib();
    const p = proprietesAvatar(`${SB}/job-offers/admin-posters/a-w1280.webp`, 40, HOTE);
    expect(p).toEqual({
      src: `${HOTE}/job-offers/admin-posters/a-w1280.webp`,
      srcSet: `${HOTE}/job-offers/admin-posters/a-w480.webp 480w, ${HOTE}/job-offers/admin-posters/a-w960.webp 960w, ${HOTE}/job-offers/admin-posters/a-w1280.webp 1280w`,
      sizes: "40px",
      loading: "lazy",
      decoding: "async",
    });
  });
  test("ouvert, image sans variantes (ancien JPEG, liste d'images) : seulement l'adresse du Worker et le chargement différé, pas de srcSet", async () => {
    const { proprietesAvatar } = await lib();
    const p = proprietesAvatar(`${SB}/job-offers/uuid/admin-offers-1790383561176-0.jpeg`, 40, HOTE);
    expect(p).toEqual({ src: `${HOTE}/job-offers/uuid/admin-offers-1790383561176-0.jpeg`, loading: "lazy", decoding: "async" });
    const liste = proprietesAvatar(JSON.stringify([`${SB}/job-offers/a-w1280.webp`]), 40, HOTE);
    expect(liste.srcSet).toBeUndefined();
  });
  test("ouvert, image d'un autre bucket ou d'ailleurs : adresse inchangée et aucun srcSet", async () => {
    const { proprietesAvatar } = await lib();
    expect(proprietesAvatar(`${SB}/avatars/u/p.jpg`, 40, HOTE)).toEqual({ src: `${SB}/avatars/u/p.jpg`, loading: "lazy", decoding: "async" });
    expect(proprietesAvatar("https://exemple.test/x-w1280.webp", 40, HOTE).srcSet).toBeUndefined();
  });
  test("le navigateur peut toujours se rabattre sur Supabase : le repli retrouve les variantes d'origine", async () => {
    const { proprietesAvatar, adresseSupabase } = await lib();
    const url = `${SB}/stories-media/s/x-w1280.webp`;
    const p = proprietesAvatar(url, 40, HOTE);
    expect(adresseSupabase(p.srcSet, HOTE)).toBe(`${SB}/stories-media/s/x-w480.webp 480w, ${SB}/stories-media/s/x-w960.webp 960w, ${SB}/stories-media/s/x-w1280.webp 1280w`);
    expect(adresseSupabase(p.src, HOTE)).toBe(url);
  });
});
