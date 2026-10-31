const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Visionneuse « Photos & vidéo » de Locaux : plus de bouton « Envoyer demande » (31/10/2026), seulement « Discuter ici ».
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

test("la visionneuse n'a plus « Envoyer demande » : elle montre « Discuter » et « WhatsApp », comme la fiche de l'article", () => {
  const c = lire("mobile/src/app/marketplace/photos.tsx");
  expect(c).not.toContain(">Envoyer demande<");
  expect(c).not.toContain("setCommandeOuverte(true)");
  expect(c).not.toContain("Discuter ici");
  expect(c).toContain(">Discuter</Text>");
  expect(c).toContain(">WhatsApp</Text>");
  expect(c).toContain("onPress={discuter}");
  expect(c).toContain("onPress={ecrireSurWhatsapp}");
  expect(c).toContain("lienWhatsapp(article)");
  expect(c).toContain("disabled={!whatsapp || estMonArticle}");
});
