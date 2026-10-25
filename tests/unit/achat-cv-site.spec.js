const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Page « Achat de CV » du site (même design que l'onglet de l'application) : logique pure, aperçu protégé, paiement par le composant commun
 * (AttentePaiementQr), et masquage dans l'application iOS (règle Apple 3.1.1) via le marqueur « FaciliteApp/ios » de la WebView.
 */
const logique = () => import("../../src/lib/achatCvSite.js");
const contexte = () => import("../../src/lib/contextePlay.js");
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");
const ID = "33333333-3333-4333-8333-333333333333";

test.describe("logique de la page Achat de CV du site", () => {
  test("prix « 1 500 FCFA » avec espaces insécables, lecture des modèles sans aucun chemin de fichier, jamais gratuit", async () => {
    const { prixFcfa, lireModele } = await logique();
    expect(prixFcfa(1500)).toBe("1 500 FCFA");
    expect(prixFcfa(100)).toBe("100 FCFA");
    const m = lireModele({ id: ID, nom: "Classique", description: "Sobre", prix_xof: 1500, nb_pages: 2, achete: true, fichier_livre: "secret.pdf", apercus: ["a.webp"] });
    expect(m).toEqual({ id: ID, nom: "Classique", description: "Sobre", prixXof: 1500, nbPages: 2, achete: true });
    expect(lireModele({ id: ID, nom: "Gratuit", prix_xof: 0 })).toBeNull();
    expect(lireModele(null)).toBeNull();
  });

  test("textes de l'aperçu : « Page 2 / 3 · glissez ←→ », « Acheter ce modèle · 1 500 FCFA », « Utiliser ce modèle »", async () => {
    const { textePage, texteBoutonApercu, pageDepuisDecalage } = await logique();
    expect(textePage(2, 3)).toBe("Page 2 / 3 · glissez ←→");
    expect(textePage(9, 3)).toBe("Page 3 / 3 · glissez ←→");
    expect(texteBoutonApercu({ prixXof: 1500, achete: false })).toBe("Acheter ce modèle · 1 500 FCFA");
    expect(texteBoutonApercu({ prixXof: 1500, achete: true })).toBe("Utiliser ce modèle");
    expect(pageDepuisDecalage(0, 300, 3)).toBe(1);
    expect(pageDepuisDecalage(620, 300, 3)).toBe(3);
    expect(pageDepuisDecalage(9000, 300, 3)).toBe(3);
  });

  test("filigrane « APERÇU · FACILITÉ » en motif répété ; adresse d'aperçu limitée à un UUID et une page de 1 à 10", async () => {
    const { motifFiligrane, adresseApercu, TEXTE_FILIGRANE } = await logique();
    expect(decodeURIComponent(motifFiligrane())).toContain(TEXTE_FILIGRANE);
    expect(motifFiligrane()).toMatch(/^url\("data:image\/svg\+xml/);
    expect(adresseApercu(ID, 2)).toBe(`/api/cv-modeles/${ID}/apercu/2`);
    for (const page of [0, 11, 1.5, NaN]) expect(adresseApercu(ID, page)).toBeNull();
    for (const id of ["../x", "abc", ""]) expect(adresseApercu(id, 1)).toBeNull();
  });

  test("messages : reçu (vert), déjà en cours (rouge), annulé / expiré (gris)", async () => {
    const { messageAchat } = await logique();
    expect(messageAchat("recu", "Classique")).toEqual({ texte: "Paiement reçu : le modèle « Classique » est à vous.", couleur: "vert" });
    expect(messageAchat("deja_prepare").couleur).toBe("rouge");
    expect(messageAchat("annule").texte).toBe("Paiement annulé. Aucun montant n'a été débité.");
    expect(messageAchat("expire").couleur).toBe("gris");
    expect(messageAchat("inconnu")).toBeNull();
  });
});

test.describe("masquage dans l'application iOS (règle Apple 3.1.1)", () => {
  const sauvegarde = {};
  const poser = (nom, valeur) => Object.defineProperty(globalThis, nom, { value: valeur, configurable: true, writable: true });
  test.beforeEach(() => {
    for (const n of ["window", "document", "navigator"]) sauvegarde[n] = Object.getOwnPropertyDescriptor(globalThis, n);
  });
  test.afterEach(() => {
    for (const n of ["window", "document", "navigator"]) {
      if (sauvegarde[n]) Object.defineProperty(globalThis, n, sauvegarde[n]);
      else delete globalThis[n];
    }
  });
  function navigateur(userAgent, { referrer = "", url = "https://ffacilite.com/achat-cv" } = {}) {
    const stock = new Map();
    poser("window", { sessionStorage: { getItem: (k) => stock.get(k) ?? null, setItem: (k, v) => stock.set(k, v) }, location: { href: url } });
    poser("document", { referrer });
    poser("navigator", { userAgent });
    return stock;
  }

  test("la WebView iOS de l'application (marqueur FaciliteApp/ios) est reconnue, et mémorisée pour la suite de la session", async () => {
    const { estDansAppPlay, MARQUEUR_APP_IOS } = await contexte();
    expect(MARQUEUR_APP_IOS).toBe("FaciliteApp/ios");
    const stock = navigateur("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 FaciliteApp/ios");
    expect(estDansAppPlay()).toBe(true);
    expect(stock.get("facilite:contexte-play")).toBe("1");
  });

  test("Safari sur iPhone, Chrome sur Android et ordinateur : l'achat reste visible ; la TWA Android reste détectée comme avant", async () => {
    const { estDansAppPlay } = await contexte();
    navigateur("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1");
    expect(estDansAppPlay()).toBe(false);
    navigateur("Mozilla/5.0 (Linux; Android 14; SM-X200) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36");
    expect(estDansAppPlay()).toBe(false);
    navigateur("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36");
    expect(estDansAppPlay()).toBe(false);
    navigateur("Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36", { referrer: "android-app://com.ffacilite.app" });
    expect(estDansAppPlay()).toBe(true);
  });

  test("les pages de paiement existantes testent déjà estDansAppPlay : le marqueur iOS les couvre toutes", () => {
    for (const f of ["src/app/premium/PremiumClient.jsx", "src/app/formation-redaction-cv/FormationRedactionCvClient.jsx", "src/components/PricingModal.js", "src/app/achat-cv/AchatCvClient.jsx", "src/components/OngletAchatCv.jsx"]) {
      expect(lire(f)).toContain("estDansAppPlay()");
    }
  });
});

test.describe("structure de la page et du paiement", () => {
  const client = lire("src/app/achat-cv/AchatCvClient.jsx");

  test("paiement : composant commun AttentePaiementQr, « Payer avec MAXIT » sur téléphone, seul modeleId envoyé, état lu sur le serveur", () => {
    expect(client).toContain('import AttentePaiementQr from "@/components/AttentePaiementQr"');
    expect(client).toContain("<AttentePaiementQr");
    expect(client).toContain("libelleBoutonPaiement(estMobile");
    expect(client).toContain("tenterAuto(");
    expect(client).toContain("body: JSON.stringify({ modeleId: modeleCourant.id })");
    expect(client).toContain("/api/pay/cv-checkout?achatId=");
    expect(client).not.toMatch(/crediter|\.from\("cv_achats"\)|\.insert\(|\.update\(/); // aucun achat accordé par la page
    expect(client).toContain("setInterval(interroger, POLL_INTERVAL_MS)");
  });

  test("catalogue : un seul bouton « Acheter » par modèle, lien « Voir l'aperçu », chargement (4 cartes), vide ; aucun nom de fichier ni chemin", () => {
    expect(client.match(/>\s*Acheter\s*</g)).toHaveLength(1);
    for (const t of ["Voir l&apos;aperçu", "Utiliser ce modèle", "Aucun modèle disponible pour le moment.", "Modèles de CV", "[0, 1, 2, 3].map"]) expect(client).toContain(t);
    expect(client).toContain('supabase.rpc("lister_modeles_cv")');
    expect(client).not.toMatch(/fichier_livre|cv-modeles-livres|from\("cv_modeles"\)/);
  });

  test("aperçu protégé : images chargées avec la session, floutées, filigrane par-dessus, clic droit et glisser bloqués, aucun bouton de téléchargement", () => {
    const debut = client.indexOf('data-testid="apercu-protege"');
    const apercu = client.slice(debut);
    expect(client).toContain('cache: "no-store"');
    expect(client).toContain("blur-[1px]");
    expect(client).toContain("draggable={false}");
    expect(client).toContain("onContextMenu={(e) => e.preventDefault()}");
    expect(client).toContain("backgroundImage: motifFiligrane()");
    expect(client).toContain("select-none");
    expect(apercu).toContain("snap-x snap-mandatory");
    expect(apercu).toContain("Aperçu protégé : non téléchargeable.");
    expect(apercu).not.toMatch(/Télécharger|Partager|Imprimer|Enregistrer|Copier|<a\s|download/);
  });

  test("retour du paiement vers /achat-cv (page qui LIT l'état) ; message neutre dans l'application iOS ; lien dans le Profil", () => {
    expect(lire("src/app/api/pay/cv-checkout/route.js")).toContain("/achat-cv?statut=succes&commande=${achatId}");
    expect(client).toContain("Indisponible dans l&apos;application");
    expect(client).not.toMatch(/Indisponible[\s\S]{0,400}(FCFA|Acheter|MAXIT)/);
    expect(lire("src/app/profil/page.js")).toContain("<OngletAchatCv />");
    expect(lire("src/components/OngletAchatCv.jsx")).toContain('href="/achat-cv"');
  });
});
