const { test, expect } = require("@playwright/test");
const {
  etatDiscussionArticle,
  construireLienDiscussion,
  construireBrouillonArticle,
} = require("../../src/lib/discussionArticle.js");

/**
 * Logique pure de "Discuter sur la plateforme" (fiche produit) : aucun
 * navigateur, aucun réseau. Voir src/lib/discussionArticle.js.
 */

test.describe("etatDiscussionArticle", () => {
  test("sur son propre article : boutons grisés", () => {
    expect(etatDiscussionArticle({ userId: "u1", proprietaireId: "u1" })).toBe("mon-article");
  });
  test("article d'un autre vendeur : discussion possible", () => {
    expect(etatDiscussionArticle({ userId: "u1", proprietaireId: "u2" })).toBe("pret");
  });
  test("visiteur non connecté : discussion possible (la connexion est demandée ensuite)", () => {
    expect(etatDiscussionArticle({ userId: null, proprietaireId: "u2" })).toBe("pret");
  });
  test("propriétaire pas encore connu : ni lien ni faux départ vers une messagerie vide", () => {
    expect(etatDiscussionArticle({ userId: "u1", proprietaireId: null })).toBe("chargement");
    expect(etatDiscussionArticle({ userId: null, proprietaireId: undefined })).toBe("chargement");
  });
});

test.describe("construireLienDiscussion", () => {
  test("le lien porte le vendeur, le contexte Marketplace et l'article (titre, id, prix)", () => {
    const lien = construireLienDiscussion({
      proprietaireId: "vendeur-1",
      article: { id: "art-12345678", titre: "Gel Exfoliant & Purifiant" },
      prixUnitaire: 5000,
    });
    const url = new URL(lien, "https://exemple.test");
    expect(url.pathname).toBe("/messagerie");
    expect(url.searchParams.get("recipient")).toBe("vendeur-1");
    expect(url.searchParams.get("contexte")).toBe("marketplace");
    expect(url.searchParams.get("article")).toBe("Gel Exfoliant & Purifiant");
    expect(url.searchParams.get("articleId")).toBe("art-12345678");
    expect(url.searchParams.get("prix")).toBe("5000");
  });

  test("un titre avec des caractères spéciaux ne casse pas l'URL", () => {
    const lien = construireLienDiscussion({
      proprietaireId: "v",
      article: { id: "abcdef12", titre: "Sérum 100% « bio » #1 ?x=1&y=2" },
      prixUnitaire: 3000,
    });
    const url = new URL(lien, "https://exemple.test");
    expect(url.searchParams.get("article")).toBe("Sérum 100% « bio » #1 ?x=1&y=2");
    expect(url.searchParams.get("recipient")).toBe("v");
  });

  test("sans prix valide, aucun paramètre prix", () => {
    const lien = construireLienDiscussion({ proprietaireId: "v", article: { id: "abcdef12", titre: "X" }, prixUnitaire: 0 });
    expect(new URL(lien, "https://exemple.test").searchParams.has("prix")).toBe(false);
  });
});

test.describe("construireBrouillonArticle", () => {
  const base = { titre: "Gel Exfoliant", articleId: "abcdef12-3456", prix: "5000", origine: "https://ffacilite.com" };

  test("le brouillon nomme l'article, son prix et son lien", () => {
    const b = construireBrouillonArticle(base);
    expect(b).toContain("« Gel Exfoliant »");
    expect(b).toContain("(5 000 FCFA)");
    expect(b).toContain("Lien : https://ffacilite.com/marketplace?article=abcdef12-3456");
    expect(b).toContain("Est-il toujours disponible ?");
  });

  test("sans titre : aucun brouillon", () => {
    expect(construireBrouillonArticle({ ...base, titre: "" })).toBe("");
    expect(construireBrouillonArticle({ ...base, titre: null })).toBe("");
    expect(construireBrouillonArticle({ ...base, titre: "   " })).toBe("");
  });

  test("sans prix : pas de parenthèse de prix", () => {
    const b = construireBrouillonArticle({ ...base, prix: undefined });
    expect(b).not.toContain("FCFA");
    expect(b).toContain("« Gel Exfoliant »");
  });

  test("identifiant douteux (venu de l'URL) : le lien est omis, le reste du message est conservé", () => {
    const b = construireBrouillonArticle({ ...base, articleId: "x\"><script>alert(1)</script>" });
    expect(b).not.toContain("Lien :");
    expect(b).not.toContain("<script>");
    expect(b).toContain("« Gel Exfoliant »");
  });

  test("titre nettoyé : sauts de ligne supprimés et longueur bornée", () => {
    const b = construireBrouillonArticle({ ...base, titre: "Ligne1\nLigne2\r\n" + "a".repeat(400) });
    const premiereLigne = b.split("\n")[0];
    expect(premiereLigne).toContain("« Ligne1 Ligne2 ");
    expect(premiereLigne.length).toBeLessThan(220);
  });

  test("prix formaté avec séparateur de milliers", () => {
    expect(construireBrouillonArticle({ ...base, prix: "15000" })).toContain("(15 000 FCFA)");
    expect(construireBrouillonArticle({ ...base, prix: "250" })).toContain("(250 FCFA)");
  });
});
