const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

/**
 * Livraison d'un document à un candidat (administration) — 15/11/2026 : « je viens de livrer un document à Moussa mais je ne vois rien dans l'application, aucune notification ».
 * Constaté dans la base : aucune ligne de livraison, aucun fichier déposé, aucune notification pour ce compte : la livraison n'a JAMAIS démarré. Sur la capture, le champ « Titre » est vide (texte
 * d'exemple en gris) : le site refuse de livrer sans titre de 3 lettres, et le disait par un petit message en haut qui disparaît au bout de 3 secondes, que personne n'a vu.
 * Correctif : le titre est proposé d'après le nom du fichier, le bouton dit ce qui manque (et reste grisé), et le résultat (déposé, demande envoyée, erreur) reste affiché dans le panneau.
 */
const racine = path.join(__dirname, "../..");
const lire = (p) => fs.readFileSync(path.join(racine, p), "utf8").replace(/\r\n/g, "\n");

function logique() {
  const src = lire("src/lib/livraisonDocumentLogique.js");
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const m = { exports: {} };
  new Function("module", "exports", js)(m, m.exports);
  return m.exports;
}

test("le titre est proposé d'après le nom du fichier", () => {
  const l = logique();
  expect(l.titreDepuisNomFichier("MAMADOU SOWcv (2).pdf")).toBe("MAMADOU SOWcv (2)");
  expect(l.titreDepuisNomFichier("CV_Awa_Diop.docx")).toBe("CV Awa Diop");
  expect(l.titreDepuisNomFichier("  rapport   final.PDF ")).toBe("rapport final");
  expect(l.titreDepuisNomFichier("sans_extension")).toBe("sans extension");
  expect(l.titreDepuisNomFichier(null)).toBe("");
});

test("ce qui manque pour livrer : rien (null), le fichier, le titre, ou les deux", () => {
  const l = logique();
  const fichier = { name: "cv.pdf" };
  expect(l.manqueAvantLivraison(fichier, "CV Awa")).toBeNull();
  expect(l.manqueAvantLivraison(fichier, "  ")).toContain("Donnez un titre");
  expect(l.manqueAvantLivraison(fichier, "ab")).toContain("3 lettres au moins");
  expect(l.manqueAvantLivraison(null, "CV Awa")).toContain("Choisissez le fichier");
  expect(l.manqueAvantLivraison(null, "")).toContain("fichier et donnez un titre");
  expect(l.TITRE_MIN).toBe(3);
});

test("messages après la livraison : déposé, demande envoyée, erreur", () => {
  const l = logique();
  const depose = l.messageApresLivraison("delivered", "Moussa Kane");
  expect(depose.ok).toBe(true);
  expect(depose.texte).toContain("Document déposé chez Moussa Kane");
  expect(depose.texte).toContain("notification");
  const plein = l.messageApresLivraison("pending_replacement", "Moussa Kane");
  expect(plein.ok).toBe(true);
  expect(plein.texte).toContain("espace est plein");
  expect(plein.texte).toContain("Rien n'est déposé avant sa réponse");
  const echec = l.messageErreurLivraison(new Error("new row violates row-level security policy"));
  expect(echec.ok).toBe(false);
  expect(echec.texte).toBe("Livraison impossible : new row violates row-level security policy");
  expect(l.messageErreurLivraison(null).texte).toContain("erreur inconnue");
});

test("le panneau d'administration : titre obligatoire signalé, bouton grisé avec la raison, résultat affiché dans le panneau", () => {
  const p = lire("src/app/admin/page.js");
  expect(p).toContain('import { manqueAvantLivraison, messageApresLivraison, messageErreurLivraison, titreDepuisNomFichier } from "@/lib/livraisonDocumentLogique";');
  // la validation passe par la logique commune, et laisse une trace dans le panneau (pas seulement un message de 3 secondes)
  expect(p).toContain("const manque = manqueAvantLivraison(livraisonFichier, titre);");
  expect(p).toContain("setLivraisonMessage({ ok: false, texte: manque, pour: candidateId });");
  expect(p).toContain("setLivraisonMessage({ ...apres, pour: candidateId });");
  expect(p).toContain("setLivraisonMessage({ ...echec, pour: candidateId });");
  // formulaire
  expect(p).toContain("Titre du document (obligatoire)");
  expect(p).toContain("if (fichier && !livraisonTitre.trim()) setLivraisonTitre(titreDepuisNomFichier(fichier.name));");
  expect(p).toContain("disabled={livraisonEnCours || manque !== null}");
  expect(p).toContain("{manque && !livraisonEnCours ?");
  expect(p).toContain("livraisonMessage && livraisonMessage.pour === user.id");
  // la livraison elle-même ne change pas : même dépôt, même fonction serveur
  expect(p).toContain('supabase.rpc("livrer_document", {');
  expect(p).toContain("const chemin = `${candidateId}/livraisons/${Date.now()}-${nomSur}`;");
  // l'ancienne validation silencieuse a disparu
  expect(p).not.toContain("Choisissez le fichier a livrer.");
});
