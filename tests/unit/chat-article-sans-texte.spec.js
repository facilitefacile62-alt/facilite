const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * « Discuter » depuis un article (Locaux) : la zone d'écriture est VIDE (la personne écrit son message), l'article est montré en carte au-dessus, et sa
 * référence part avec le premier message pour que le vendeur reconnaisse le produit. Plus de « &apos; » affiché dans le fil vide.
 */
const racine = path.join(__dirname, "../..");
const lire = (p) => fs.readFileSync(path.join(racine, p), "utf8").replace(/\r\n/g, "\n");

test("la référence envoyée au vendeur reprend les 2 premières lignes du message d'article (sans la question toute faite) ; le brouillon complet reste pour WhatsApp", () => {
  const m = lire("mobile/src/lib/marketplace.ts");
  expect(m).toContain("export function referenceArticle(");
  const bs = String.fromCharCode(92);
  expect(m).toContain(".split('" + bs + "n').slice(0, 2).join('" + bs + "n')");
  expect(m).toContain("'Est-il toujours disponible ?'");
  expect(m).toContain("const texte = encodeURIComponent(brouillonArticle(article));");
  expect(lire("mobile/src/components/CarteArticleMessage.tsx")).toContain("intéressé\(e\) par votre article");
});

test("les écrans d'article ne préremplissent plus la zone d'écriture", () => {
  for (const f of ["mobile/src/app/marketplace/[id].tsx", "mobile/src/app/marketplace/photos.tsx"]) {
    expect(lire(f), f).not.toMatch(/brouillon:\s*brouillonArticle/);
  }
});

test("le chat : carte de l'article au-dessus de la zone d'écriture, référence envoyée AVANT le premier message, une seule fois ; apostrophe correcte", () => {
  const c = lire("mobile/src/app/chat/[id].tsx");
  expect(c).toContain("Votre message concerne cet article :");
  expect(c).toContain("await envoyer(referenceArticle(articleContexte));");
  expect(c).toContain("setReferenceEnvoyee(true);");
  expect(c).toContain("referenceDejaDansLeFil");
  expect(c).not.toContain("&apos;instant");
  expect(c).toContain("Aucun message pour l'instant");
});
