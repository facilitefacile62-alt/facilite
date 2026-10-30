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
    for (const interdit of ["prixFcfa", "prixXof", "prix_xof", "achat-cv-payer", "creerPaiementCv", "Acheter", "FCFA", "lienTelechargementCv", "achatCv", "lister_modeles_cv"]) expect(c, interdit).not.toContain(interdit);
    expect(c).toContain("chargerModelesDocuments()");
    expect(c).toContain("source={{ uri: m.imageUrl }}");
    expect(c).toContain("https://wa.me/${WHATSAPP_FACILITE}?text=${encodeURIComponent(messageDemandeModele(m.nom, m.imageUrl, m.messageWhatsapp))}");
    expect(c).toContain("Demander ce modèle");
  });
  test("le catalogue lit modeles_documents (modèles actifs, rang croissant), sans prix ; une ligne illisible est ignorée", async () => {
    const l = lire("mobile/src/lib/modelesDocuments.ts");
    expect(l).toContain(".from('modeles_documents')");
    expect(l).toContain(".eq('actif', true)");
    expect(l).not.toContain("prix");
    const { lireModeleDocument } = await import("../../mobile/src/lib/modelesDocumentsLogique.ts");
    const ok = { id: "1", type: "lettre", nom: " Lettre simple ", description: " courte ", image_url: "https://x.supabase.co/a.webp", ordre: 1 };
    expect(lireModeleDocument(ok)).toEqual({ id: "1", type: "lettre", nom: "Lettre simple", description: "courte", imageUrl: "https://x.supabase.co/a.webp", messageWhatsapp: "" });
    expect(lireModeleDocument({ ...ok, type: "autre" }).type).toBe("cv");
    for (const mauvais of [null, "x", {}, { ...ok, nom: "" }, { ...ok, image_url: "http://x/a.jpg" }, { ...ok, image_url: undefined }, { ...ok, id: 3 }]) expect(lireModeleDocument(mauvais)).toBeNull();
  });
  test("le message WhatsApp contient le nom du modèle", async () => {
    const { messageDemandeModele } = await import("../../mobile/src/lib/modelesDocumentsLogique.ts");
    expect(messageDemandeModele("Modèle Classique", "https://x.supabase.co/a.webp")).toBe("Bonjour Facilité, je souhaite le modèle de document « Modèle Classique » que j'ai vu dans l'application.\nVoici l'affiche : https://x.supabase.co/a.webp");
    expect(messageDemandeModele("Modèle Classique", "http://x/a.jpg")).not.toContain("affiche");
    expect(messageDemandeModele("Modèle Classique")).toBe("Bonjour Facilité, je souhaite le modèle de document « Modèle Classique » que j'ai vu dans l'application.");
  });
});

test.describe("Modèle cliquable : vue d'ensemble", () => {
  test("toucher l'image ou le nom ouvre l'affiche entière dans une fenêtre, avec « Demander ce modèle » et un bouton Fermer", () => {
    const c = lire("mobile/src/components/CatalogueModelesDocuments.tsx");
    expect(c).toContain("onPress={() => setIndexOuvert(i)}");
    expect(c).toContain("<Modal visible={ouvert !== null}");
    expect(c).toContain('contentFit="contain"');
    // Plusieurs modèles : on passe de l'un à l'autre en faisant glisser l'affiche (pagination horizontale), avec « 2 / 5 » et des points.
    expect(c).toContain("horizontal");
    expect(c).toContain("pagingEnabled");
    expect(c).toContain("initialScrollIndex={indexOuvert ?? 0}");
    expect(c).toContain("onPress={() => demander(ouvert)}");
    expect(c).toContain('accessibilityLabel="Fermer"');
  });
});

test.describe("Phrase WhatsApp saisie par l'administrateur", () => {
  const A = "https://x.supabase.co/a.webp";
  test("avec une phrase : la phrase puis le lien de l'affiche sur la ligne suivante ; {nom} remplacé ; sans lien valide : la phrase seule", async () => {
    const { messageDemandeModele } = await import("../../mobile/src/lib/modelesDocumentsLogique.ts");
    expect(messageDemandeModele("Pack CV", A, "Bonjour, je veux le {nom} !")).toBe("Bonjour, je veux le Pack CV !\n" + A);
    expect(messageDemandeModele("Pack CV", "http://x/a.jpg", "Salut")).toBe("Salut");
    expect(messageDemandeModele("Pack CV", A, "   ")).toContain("Voici l'affiche : " + A); // phrase vide : phrase par défaut
    expect(messageDemandeModele("Pack CV", A, null)).toContain("Voici l'affiche : " + A);
  });
  test("le catalogue lit la phrase (colonne message_whatsapp) et la passe au message ; ligne sans phrase : vide", async () => {
    const { lireModeleDocument } = await import("../../mobile/src/lib/modelesDocumentsLogique.ts");
    const base = { id: "1", type: "cv", nom: "Pack", description: "", image_url: A, ordre: 1 };
    expect(lireModeleDocument({ ...base, message_whatsapp: " Bonjour " }).messageWhatsapp).toBe("Bonjour");
    expect(lireModeleDocument(base).messageWhatsapp).toBe("");
    expect(lire("mobile/src/lib/modelesDocuments.ts")).toContain("ordre, message_whatsapp");
    expect(lire("mobile/src/components/CatalogueModelesDocuments.tsx")).toContain("messageDemandeModele(m.nom, m.imageUrl, m.messageWhatsapp)");
  });
  test("l'administration : champ « phrase » à la création, bouton « Phrase WhatsApp » par modèle, limite de 300, la story liée suit", () => {
    const page = lire("src/app/admin/modeles-documents/page.js");
    expect(page).toContain('id="modele-phrase"');
    expect(page).toContain("message_whatsapp: form.message_whatsapp");
    expect(page).toContain("Phrase WhatsApp");
    const route = lire("src/app/api/admin/modeles-documents/route.js");
    expect(route).toContain("phrase.length > 300");
    expect(route).toContain("champs.message_whatsapp = phrase || null");
    expect(route).toContain('admin.from("stories").update({ message_whatsapp: messagePourModele(');
  });
  test("migration additive (une colonne facultative, lecture seule pour les comptes connectés) et retour arrière présent", () => {
    const sql = lire("supabase/migrations/20261030120000_modeles_documents_phrase_whatsapp.sql");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS message_whatsapp text");
    expect(sql).toContain("GRANT SELECT (message_whatsapp) ON public.modeles_documents TO authenticated");
    expect(sql).not.toMatch(/DROP|DELETE|UPDATE\s|TRUNCATE|GRANT (INSERT|UPDATE|ALL)/i);
    expect(lire("docs/rollbacks/20261030120000_modeles_documents_phrase_whatsapp.down.sql")).toContain("DROP COLUMN IF EXISTS message_whatsapp");
  });
});
