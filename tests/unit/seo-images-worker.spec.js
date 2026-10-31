const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Étape 7 : aperçus de partage des offres et des articles, et photos des articles du Marketplace, servis par le Worker Cloudflare (cache d'un an) quand
 * l'interrupteur NEXT_PUBLIC_IMAGES_HOTE est ouvert. Réécriture à l'affichage seulement, repli automatique sur Supabase, avatars et couvertures jamais touchés.
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");
const mod = () => import("../../src/lib/imagesPubliques.js");
const HOTE = "https://facilite-images.exemple.workers.dev";
const REF = "ocfhzwwjvljintabxxlg";

test("aperçu : une photo du bucket marketplace-photos passe par le Worker ; interrupteur fermé, rien ne change ; avatars et couvertures jamais", async () => {
  const { adresseImage } = await mod();
  const photo = `https://${REF}.supabase.co/storage/v1/object/public/marketplace-photos/u1/a.webp`;
  expect(adresseImage(photo, HOTE)).toBe(`${HOTE}/marketplace-photos/u1/a.webp`);
  expect(adresseImage(photo, "")).toBe(photo);
  const avatar = `https://${REF}.supabase.co/storage/v1/object/public/avatars/u1/a.webp`;
  const couverture = `https://${REF}.supabase.co/storage/v1/object/public/covers/u1/c.webp`;
  expect(adresseImage(avatar, HOTE)).toBe(avatar);
  expect(adresseImage(couverture, HOTE)).toBe(couverture);
});

test("échec définitif : le composant n'affiche son image de remplacement qu'après l'essai de repli sur Supabase", async () => {
  const { echecDefinitif } = await mod();
  const el = (dataset) => ({ dataset });
  expect(echecDefinitif(el({}))).toBe(true); // image qui ne vient pas du Worker : échec définitif tout de suite
  const e = el({ repliSupabase: "1" }); // le filet global vient de relancer l'image sur Supabase
  expect(echecDefinitif(e)).toBe(false); // on attend ce second essai
  expect(echecDefinitif(e)).toBe(true); // second essai échoué : définitif
  expect(echecDefinitif(null)).toBe(true);
});

test("fiche offre : image d'aperçu (og et twitter) et logo du JobPosting passent par adresseImage", () => {
  const p = lire("src/app/offres/[id]/page.js");
  expect(p).toContain('import { adresseImage } from "@/lib/imagesPubliques";');
  expect(p).toMatch(/const imageUrl = adresseImage\(/);
  expect(p).toMatch(/const logoUrl = adresseImage\(/);
  expect(p).toContain("images: [{ url: imageUrl,");
  expect(p).toContain("images: [imageUrl],");
});

test("aperçu d'un article : la photo passe par adresseImage", () => {
  const p = lire("src/app/marketplace/page.js");
  expect(p).toContain("adresseImage(/^https?:/i.test(brute)");
});

test("Marketplace : adresseImage n'est appliquée que dans des attributs src d'affichage ; urlPhoto et la couche de données restent intacts ; les enregistrements gardent l'adresse d'origine", () => {
  const c = lire("src/app/marketplace/MarketplaceClient.jsx");
  const emplois = c.split("\n").filter((l) => l.includes("adresseImage(") && !l.startsWith("import "));
  expect(emplois.length).toBeGreaterThanOrEqual(7);
  for (const l of emplois) expect(l, l).toMatch(/src=\{adresseImage\(/);
  expect(c).toContain("const publicPhotoUrl = urlPhoto(photoPath);");
  expect(c).not.toMatch(/update\([^)]*adresseImage/);
  expect(lire("src/lib/marketplaceData.js")).not.toContain("imagesPubliques");
  // La photo principale sert aussi au lien de discussion (enregistré dans un message) : sa valeur reste l'adresse d'origine.
  expect(c).toContain("photoUrl: photoPrincipale");
  expect(c).toContain("if (echecDefinitif(e.currentTarget)) setImageErreur(true);");
  expect(c).toContain("key={photoPrincipale}");
});
