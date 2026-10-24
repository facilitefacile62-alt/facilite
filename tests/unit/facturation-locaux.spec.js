const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Page de facturation de Locaux (application) : logique pure, textes de la maquette du 24/10/2026, et garanties de sécurité (jetons crédités
 * uniquement par le serveur, page qui ne défile pas, aucun « + » flottant).
 */
const logique = () => import("../../mobile/src/lib/facturationLogique.ts");
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");

test.describe("logique de la page de facturation", () => {
  test("montants avec séparateur de milliers, compteur de 10 à 500 par pas de 10", async () => {
    const { formaterMontant, quantiteSuivante } = await logique();
    expect(formaterMontant(1000).replace(/\s/g, " ")).toBe("1 000");
    expect(formaterMontant(100)).toBe("100");
    expect(formaterMontant(50000).replace(/\s/g, " ")).toBe("50 000");
    expect(quantiteSuivante(10, -1)).toBe(10); // jamais en dessous de 10
    expect(quantiteSuivante(10, 1)).toBe(20);
    expect(quantiteSuivante(490, 1)).toBe(500);
    expect(quantiteSuivante(500, 1)).toBe(500); // jamais au-dessus de 500
    expect(quantiteSuivante(NaN, 1)).toBe(20);
  });

  test("compte à rebours « 4:40 », validité « valable 5 minutes »", async () => {
    const { compteARebours, texteValidite, secondesRestantes } = await logique();
    expect(compteARebours(300)).toBe("5:00");
    expect(compteARebours(280)).toBe("4:40");
    expect(compteARebours(5)).toBe("0:05");
    expect(compteARebours(-4)).toBe("0:00");
    expect(texteValidite(300)).toBe("valable 5 minutes");
    expect(secondesRestantes(10_000, 4_100)).toBe(6);
    expect(secondesRestantes(10_000, 99_000)).toBe(0);
  });

  test("activation de Premium : possible à 50 jetons ou plus, impossible sinon ou déjà actif ; « Il vous manque N jetons »", async () => {
    const { activationPossible, jetonsManquants } = await logique();
    expect(activationPossible(50, 50, false)).toBe(true);
    expect(activationPossible(120, 50, false)).toBe(true);
    expect(activationPossible(30, 50, false)).toBe(false);
    expect(jetonsManquants(30, 50)).toBe(20);
    expect(jetonsManquants(80, 50)).toBe(0);
    expect(activationPossible(80, 50, true)).toBe(false); // déjà actif : pas de seconde activation
    expect(activationPossible(80, 0, false)).toBe(false); // tarif absent
  });

  test("date de fin « JJ/MM/AAAA » ; messages : vert reçu, rouge déjà préparé, gris annulé et expiré", async () => {
    const { dateFr, messageFacturation } = await logique();
    expect(dateFr("2027-10-24T12:00:00.000Z")).toMatch(/^24\/10\/2027$/);
    expect(dateFr(null)).toBe("");
    expect(dateFr("pas une date")).toBe("");
    expect(messageFacturation("recu", 10)).toEqual({ texte: "Paiement reçu : +10 jetons ajoutés à votre solde.", fond: "#ECFDF5", texteCouleur: "#047857" });
    expect(messageFacturation("deja_prepare")).toEqual({ texte: "Un paiement vient d'être préparé. Patientez quelques secondes avant d'en demander un autre.", fond: "#FEF2F2", texteCouleur: "#B91C1C" });
    expect(messageFacturation("annule")).toEqual({ texte: "Paiement annulé. Aucun montant n'a été débité.", fond: "#F1F2F4", texteCouleur: "#374151" });
    expect(messageFacturation("expire")).toEqual({ texte: "Le QR code a expiré. Générez-en un nouveau.", fond: "#F1F2F4", texteCouleur: "#374151" });
  });

  test("seuls les liens sûrs s'ouvrent (jamais javascript:, data:, file:)", async () => {
    const { lienOuvrable } = await logique();
    expect(lienOuvrable("https://sugu.orange-sonatel.com/mp/123456789")).toBe(true);
    expect(lienOuvrable("maxit://pay?id=1")).toBe(true);
    for (const mauvais of ["javascript://x", "data://text/html,x", "file:///etc/passwd", "", null, undefined, 42, "pas un lien", "https://"]) expect(lienOuvrable(mauvais)).toBe(false);
  });
});

test.describe("la page respecte la maquette et la sécurité", () => {
  const ecran = lire("mobile/src/app/marketplace/vendre/facturation.tsx");

  test("textes de la maquette (sans couronne ni titre en haut, sans « + » flottant) et page qui ne défile pas", () => {
    for (const texte of [
      "Solde de jetons",
      "Activer Premium pour {requis} jetons",
      "Il vous manque {jetonsManquants(solde, requis)} jetons.",
      "Acheter des jetons",
      "Générer mon QR de paiement Orange Money",
      "Touchez le bouton : votre QR de paiement Orange Money s&apos;affiche.",
      "Scannez ce QR code avec Orange Money ou MAXIT, ou ouvrez directement votre application :",
      "Ouvrir Orange Money",
      "Ouvrir MAXIT",
      "En attente de confirmation du paiement…",
      "Premium Locaux actif",
      "Votre boutique est mise en avant jusqu&apos;au",
    ]) {
      expect(ecran).toContain(texte);
    }
    expect(ecran).not.toMatch(/ScrollView|FlatList/); // la page NE DÉFILE PAS
    expect(ecran).not.toContain("BoutonPlusLocaux"); // pas de « + » flottant
    expect(ecran).not.toMatch(/Jetons rechargeables|Premium Locaux non actif/); // pas de titre ni d'encadré « non actif »
    expect(ecran).toContain("#FF6B00"); // bouton Orange Money
    expect(ecran).toContain("#111827"); // bouton MAXIT
    expect(ecran).toContain("#F59E0B");
    expect(ecran).toContain("#FCD58F");
  });

  test("la barre fixe (compte à rebours, boutons, attente) n'existe que pendant le QR ; les cibles tactiles font au moins 44 px", () => {
    expect(ecran).toMatch(/\{paiement \? \(\s*<View style=\{\{ backgroundColor: '#e3dbcc'/);
    expect(ecran).toContain("il reste {compteARebours(reste ?? 0)}");
    expect(ecran.match(/minHeight: (\d+)/g).every((m) => Number(m.replace(/\D/g, "")) >= 44)).toBe(true);
  });

  test("les jetons ne sont JAMAIS crédités par l'application : création de la demande, lecture de l'état, activation (fonction serveur)", () => {
    const donnees = lire("mobile/src/lib/facturation.ts");
    expect(donnees).not.toMatch(/crediter_jetons|\.update\(|\.insert\(|\.upsert\(|\.delete\(/);
    expect(donnees).toContain("/api/pay/jetons-checkout");
    expect(donnees).toContain("activer_premium_marketplace");
    // L'application n'envoie QUE la boutique et la quantité : aucun prix, montant ni drapeau.
    expect(donnees).toContain("JSON.stringify({ storeId, quantiteJetons })");
  });

  test("accès : bouton « Page de facturation » dans Ma boutique, la barre du bas garde « Profil » allumé", () => {
    const maBoutique = lire("mobile/src/app/marketplace/vendre/ma-boutique.tsx");
    expect(maBoutique).toContain('titre="Page de facturation"');
    expect(maBoutique).toContain('sousTitre="Jetons et mise en avant de la boutique"');
    expect(maBoutique).toContain("/marketplace/vendre/facturation");
    expect(lire("mobile/src/components/MarketplaceBottomBar.tsx")).toContain("chemin.startsWith('/marketplace/vendre/facturation')");
  });
});
