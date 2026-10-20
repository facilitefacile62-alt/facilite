const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Images téléversées : redimensionnées à 1280 px au plus et converties en WebP avant l'envoi. Le module est de la
 * logique navigateur (canvas) : on l'exécute dans un vrai navigateur, sur une grande image générée à la volée.
 */
const source = fs.readFileSync(path.resolve(__dirname, "../../src/lib/imageUpload.js"), "utf-8").replace("export async function", "window.preparerImagePourEnvoi = async function");

test("une grande image devient un WebP de 1280 px au plus, bien plus léger", async ({ page }) => {
  await page.goto("/login");
  await page.addScriptTag({ content: source });
  const resultat = await page.evaluate(async () => {
    // Image 4000 × 3000 avec du bruit (donc peu compressible), exportée en PNG comme une capture d'écran.
    const c = document.createElement("canvas");
    c.width = 4000;
    c.height = 3000;
    const ctx = c.getContext("2d");
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `hsl(${(i * 37) % 360} 70% ${30 + (i % 40)}%)`;
      ctx.fillRect((i * 97) % 4000, (i * 53) % 3000, 300 + (i % 200), 200 + (i % 150));
    }
    const png = await new Promise((r) => c.toBlob(r, "image/png"));
    const fichier = new File([png], "affiche-test.png", { type: "image/png" });
    const sortie = await window.preparerImagePourEnvoi(fichier);
    const bmp = await createImageBitmap(sortie);
    return { avant: fichier.size, apres: sortie.size, type: sortie.type, nom: sortie.name, largeur: bmp.width, hauteur: bmp.height };
  });
  expect(resultat.type).toBe("image/webp");
  expect(resultat.nom).toBe("affiche-test.webp");
  expect(Math.max(resultat.largeur, resultat.hauteur)).toBeLessThanOrEqual(1280);
  expect(resultat.largeur / resultat.hauteur).toBeCloseTo(4 / 3, 1);
  expect(resultat.apres).toBeLessThan(resultat.avant / 2);
});

test("un fichier qui n'est pas une image, ou un GIF, est renvoyé tel quel (l'envoi ne doit jamais échouer)", async ({ page }) => {
  await page.goto("/login");
  await page.addScriptTag({ content: source });
  const resultat = await page.evaluate(async () => {
    const pdf = new File(["%PDF-1.4"], "cv.pdf", { type: "application/pdf" });
    const gif = new File(["GIF89a"], "anim.gif", { type: "image/gif" });
    const casse = new File(["pas une image"], "faux.png", { type: "image/png" });
    return [await window.preparerImagePourEnvoi(pdf) === pdf, await window.preparerImagePourEnvoi(gif) === gif, await window.preparerImagePourEnvoi(casse) === casse];
  });
  expect(resultat).toEqual([true, true, true]);
});
