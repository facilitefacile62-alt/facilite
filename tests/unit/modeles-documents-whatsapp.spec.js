const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Paiements de l'application fermés : l'onglet « Achat de CV » du profil de Facilité est remplacé par « Modèles de documents » — même liste de modèles, sans prix
 * ni achat ; « Demander ce modèle » ouvre WhatsApp vers Facilité. Paiements ouverts : l'achat de CV d'origine revient tel quel.
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

test.describe("Modèles de documents (WhatsApp) à la place de l'achat de CV", () => {
  test("le profil montre « Modèles de documents » seulement quand les paiements sont fermés ; « Achat de CV » seulement quand ils sont ouverts", () => {
    const p = lire("mobile/src/app/(tabs)/profil.tsx");
    expect(p).toContain("...(!achatsNumeriquesAutorises ? [{ id: 'modeles-documents' as const, label: 'Modèles de documents'");
    expect(p).toContain("...(achatsNumeriquesAutorises ? [{ id: 'achat-cv' as const, label: 'Achat de CV'");
    expect(p).toContain("onglet === 'modeles-documents' && !achatsNumeriquesAutorises ? (");
    expect(p).toContain("onglet === 'achat-cv' && achatsNumeriquesAutorises ? (");
  });
  test("le composant n'a ni prix, ni achat, ni paiement ; il ouvre WhatsApp avec le nom du modèle", () => {
    const c = lire("mobile/src/components/CatalogueModelesDocuments.tsx");
    for (const interdit of ["prixFcfa", "prixXof", "achat-cv-payer", "creerPaiementCv", "Acheter", "FCFA", "lienTelechargementCv"]) expect(c, interdit).not.toContain(interdit);
    expect(c).toContain("https://wa.me/${WHATSAPP_FACILITE}?text=${encodeURIComponent(messageDemandeModele(m.nom))}");
    expect(c).toContain("Demander ce modèle");
  });
  test("le message contient le nom du modèle", async () => {
    const nom = "Modèle Classique";
    const message = `Bonjour Facilité, je souhaite le modèle de document « ${nom} » que j'ai vu dans l'application.`;
    expect(lire("mobile/src/components/CatalogueModelesDocuments.tsx")).toContain("je souhaite le modèle de document « ${nom} »");
    expect(encodeURIComponent(message)).toContain(encodeURIComponent(nom));
  });
});
