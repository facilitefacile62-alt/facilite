const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * « Achat de CV » dans l'application (maquette du 24/10/2026) : logique pure, textes courts, aperçu protégé (aucun téléchargement, capture bloquée,
 * rien de net en cache), paiement sans prix venant de l'application, et masquage complet sur iOS (règle Apple 3.1.1).
 */
const logique = () => import("../../mobile/src/lib/achatCvLogique.ts");
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");
const ID = "33333333-3333-4333-8333-333333333333";

test.describe("logique de l'achat de CV", () => {
  test("lecture d'un modèle : champs de lister_modeles_cv ; ligne illisible ignorée ; aucun chemin de fichier", async () => {
    const { lireModeleCv } = await logique();
    const m = lireModeleCv({ id: ID, nom: "Classique", description: "Sobre et clair", prix_xof: 1500, nb_pages: 2, achete: false });
    expect(m).toEqual({ id: ID, nom: "Classique", description: "Sobre et clair", prixXof: 1500, nbPages: 2, achete: false });
    expect(Object.keys(m).join()).not.toMatch(/chemin|fichier|apercus|path/i);
    expect(lireModeleCv({ id: ID, nom: "X", prix_xof: 0 })).toBeNull(); // jamais gratuit
    expect(lireModeleCv({ id: ID, nom: "X", prix_xof: "abc" })).toBeNull();
    expect(lireModeleCv(null)).toBeNull();
    expect(lireModeleCv({ nom: "Sans id", prix_xof: 100 })).toBeNull();
    expect(lireModeleCv({ id: ID, nom: "Ok", prix_xof: 100, achete: "oui" }).achete).toBe(false); // seul « true » compte
  });

  test("prix « 1 500 FCFA » ; boutons « Acheter ce modèle · 1 500 FCFA » / « Utiliser ce modèle »", async () => {
    const { prixFcfa, texteBoutonApercu } = await logique();
    expect(prixFcfa(1500).replace(/\s/g, " ")).toBe("1 500 FCFA");
    expect(prixFcfa(100)).toBe("100 FCFA");
    expect(texteBoutonApercu({ prixXof: 1500, achete: false }).replace(/\s/g, " ")).toBe("Acheter ce modèle · 1 500 FCFA");
    expect(texteBoutonApercu({ prixXof: 1500, achete: true })).toBe("Utiliser ce modèle");
  });

  test("pagination de l'aperçu : « Page N / T · glissez ←→ », page déduite du défilement, bornée", async () => {
    const { textePage, pageDepuisDecalage } = await logique();
    expect(textePage(1, 3)).toBe("Page 1 / 3 · glissez ←→");
    expect(textePage(9, 3)).toBe("Page 3 / 3 · glissez ←→");
    expect(textePage(0, 3)).toBe("Page 1 / 3 · glissez ←→");
    expect(pageDepuisDecalage(0, 300, 3)).toBe(1);
    expect(pageDepuisDecalage(310, 300, 3)).toBe(2);
    expect(pageDepuisDecalage(5000, 300, 3)).toBe(3);
    expect(pageDepuisDecalage(100, 0, 3)).toBe(1);
  });

  test("messages de la maquette : vert (reçu), rouge (déjà en cours), gris (annulé, expiré, capture refusée)", async () => {
    const { messageAchatCv } = await logique();
    expect(messageAchatCv("recu", "Classique")).toMatchObject({ texte: "Paiement reçu : le modèle « Classique » est à vous.", fond: "#ECFDF5" });
    expect(messageAchatCv("deja_prepare").fond).toBe("#FEF2F2");
    expect(messageAchatCv("annule").texte).toBe("Paiement annulé. Aucun montant n'a été débité.");
    expect(messageAchatCv("expire").texte).toBe("Le QR code a expiré. Générez-en un nouveau.");
    expect(messageAchatCv("capture")).toMatchObject({ texte: "La capture d'écran est désactivée sur l'aperçu.", fond: "#F1F2F4" });
  });

  test("filigrane : « APERÇU · FACILITÉ », assez de lignes et de colonnes pour couvrir toute la page", async () => {
    const { TEXTE_FILIGRANE, grilleFiligrane } = await logique();
    expect(TEXTE_FILIGRANE).toBe("APERÇU · FACILITÉ");
    const g = grilleFiligrane(280, 373);
    expect(g.lignes).toBeGreaterThanOrEqual(4);
    expect(g.colonnes).toBeGreaterThanOrEqual(3);
    expect(grilleFiligrane(0, 0).lignes).toBeGreaterThanOrEqual(4);
  });

  test("adresse d'une page d'aperçu : seulement un UUID et une page de 1 à 10, jamais un chemin libre", async () => {
    const { adresseApercu } = await logique();
    expect(adresseApercu("https://ffacilite.com", ID, 2)).toBe(`https://ffacilite.com/api/cv-modeles/${ID}/apercu/2`);
    for (const page of [0, 11, 1.5, NaN, -1]) expect(adresseApercu("https://ffacilite.com", ID, page)).toBeNull();
    for (const id of ["../etc", "abc", `${ID}/../x`, ""]) expect(adresseApercu("https://ffacilite.com", id, 1)).toBeNull();
  });
});

test.describe("aperçu protégé : rien à télécharger, à partager ni à copier", () => {
  const ecran = lire("mobile/src/app/mon-profil/achat-cv-apercu.tsx");

  test("capture d'écran bloquée (FLAG_SECURE) et message gris en cas de tentative", () => {
    expect(ecran).toContain("ScreenCapture.usePreventScreenCapture(");
    expect(ecran).toContain("ScreenCapture.addScreenshotListener(");
    expect(ecran).toContain("messageAchatCv('capture')");
    expect(lire("mobile/package.json")).toMatch(/"expo-screen-capture": "~57\./);
  });

  test("aucun bouton ni module de téléchargement, partage, impression, enregistrement ou copie ; texte non sélectionnable", () => {
    expect(ecran).not.toMatch(/expo-sharing|expo-clipboard|expo-file-system|expo-print|expo-media-library|Share\b|printAsync|setStringAsync|saveToLibrary/);
    // « Télécharger » / « Partager » / « Imprimer » / « Enregistrer » / « Copier » n'apparaissent ni en texte ni en libellé
    const sansCommentaires = ecran.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(sansCommentaires).not.toMatch(/Télécharger|Partager|Imprimer|Enregistrer|Copier/);
    expect(sansCommentaires).toContain("selectable={false}");
    expect(ecran).toContain("Aperçu protégé : non téléchargeable.");
  });

  test("images : basse définition floutée, jamais gardées en cache, filigrane par-dessus sans geste ; défilement aimanté de gauche à droite", () => {
    expect(ecran).toContain('cachePolicy="none"');
    expect(ecran).toContain("blurRadius={1}");
    expect(ecran).toContain('pointerEvents="none"');
    expect(ecran).toContain("<Filigrane");
    expect(ecran).toContain("snapToInterval={pas}");
    expect(ecran).toContain("horizontal");
    expect(ecran).toContain("textePage(page, pages.length)");
    expect(ecran).toContain("backgroundColor: FOND");
    expect(ecran).toContain("const FOND = '#2B2A27'");
  });

  test("l'application ne demande JAMAIS le fichier livré dans l'aperçu : seulement les images d'aperçu du serveur", () => {
    expect(ecran).not.toMatch(/cv-modeles-livres|fichier_livre|telecharger\b/);
    const lib = lire("mobile/src/lib/achatCv.ts");
    expect(lire("mobile/src/lib/achatCvLogique.ts")).toContain("/api/cv-modeles/${modeleId}/apercu/${page}");
    expect(lib).not.toMatch(/\.from\('cv_modeles'\)|fichier_livre|apercus\b/);
    expect(lib).toContain("supabase.rpc('lister_modeles_cv')");
  });

  test("barre fixe en bas : « Acheter ce modèle · PRIX » mène au paiement (retour à l'aperçu), « Utiliser ce modèle » si déjà acheté", () => {
    expect(ecran).toContain("texteBoutonApercu(modele)");
    expect(ecran).toContain("achat-cv-payer?id=${modele.id}&depuis=apercu");
  });
});

test.describe("paiement et catalogue", () => {
  const payer = lire("mobile/src/app/mon-profil/achat-cv-payer.tsx");
  const catalogue = lire("mobile/src/components/CatalogueCv.tsx");
  const lib = lire("mobile/src/lib/achatCv.ts");

  test("le paiement n'envoie QUE l'identifiant du modèle : le prix est lu et fixé par le serveur", () => {
    expect(lib).toContain("body: JSON.stringify({ modeleId })");
    expect(lib).toContain("/api/pay/cv-checkout");
    expect(lib).not.toMatch(/montant\s*:|prix\s*:[^\n]*body/);
    expect(payer).toContain("creerPaiementCv(modele.id)");
    expect(payer).not.toMatch(/rpc\(|\.from\(|insert\(|update\(/); // aucune écriture d'achat côté application
  });

  test("achat confirmé seulement par l'état du serveur ; suivi toutes les 4 s et au retour dans l'application ; barre fixe pendant le QR", () => {
    expect(payer).toContain("statutAchatCv(suivi)");
    expect(payer).toContain("INTERVALLE_STATUT_MS = 4000");
    expect(payer).toContain("AppState.addEventListener('change'");
    expect(payer).toContain("<BarrePaiement");
    expect(payer).toContain("<CarteQr");
    expect(payer).toContain("Générer mon QR de paiement Orange Money");
    const barre = lire("mobile/src/components/PaiementQr.tsx");
    for (const t of ["Ouvrir Orange Money", "Ouvrir MAXIT", "En attente de confirmation du paiement…", "texteValidite(validForSeconds)"]) expect(barre).toContain(t);
    expect(barre).toContain("#FF6B00");
  });

  test("retour : Paiement → Aperçu (si ouvert depuis l'aperçu et pas encore acheté), sinon Catalogue ; Achat confirmé → Catalogue", () => {
    expect(payer).toMatch(/depuis === 'apercu' && !acheteMaintenant && router\.canGoBack\(\)\) router\.back\(\)/);
    expect(payer).toContain("router.replace('/profil?onglet=achat-cv' as Href)");
  });

  test("catalogue : un seul bouton « Acheter » par modèle, lien « Voir l'aperçu », « Acheté » + « Utiliser ce modèle » ; chargement (4 cartes) et vide", () => {
    expect(catalogue.match(/>Acheter</g)).toHaveLength(1);
    for (const t of ["Voir l&apos;aperçu", "Utiliser ce modèle", "Aucun modèle disponible pour le moment.", "Modèles de CV", "[0, 1, 2, 3].map"]) expect(catalogue).toContain(t);
    expect(catalogue).toContain("prixFcfa(m.prixXof)");
    expect(catalogue).toContain('cachePolicy="none"');
    expect(catalogue).not.toMatch(/Linking\.openURL\(['"`]http|wave|Wave/);
  });

  test("onglet « Achat de CV » après « Fonctionnalités », masqué sur iOS ; les deux écrans sont remplacés par un message neutre sur iOS", () => {
    const profil = lire("mobile/src/app/(tabs)/profil.tsx");
    expect(profil).toMatch(/\.\.\.\(achatsNumeriquesAutorises \? \[\{ id: 'achat-cv' as const, label: 'Achat de CV', icone: 'bag-handle-outline'/);
    expect(profil.indexOf("label: 'Fonctionnalités'")).toBeLessThan(profil.indexOf("label: 'Achat de CV'"));
    expect(profil).toContain("onglet === 'achat-cv' && achatsNumeriquesAutorises ? (");
    expect(payer).toContain("achatsNumeriquesAutorises ? <PayerContenu /> : <IndisponibleNeutre");
    expect(lire("mobile/src/app/mon-profil/achat-cv-apercu.tsx")).toContain("achatsNumeriquesAutorises ? <ApercuContenu /> : <IndisponibleNeutre");
  });
});
