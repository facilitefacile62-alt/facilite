const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Le champ `name` d'un QR Orange Money est refusé (HTTP 500, code 50) s'il est trop long ou accentué — constaté en production le 24/10/2026.
 * nomQrOrange() le simplifie ; les deux produits (jetons, formation CV) l'envoient à Orange.
 */
const charger = () => import("../../src/lib/orangeMoney.js");
const ASCII_SIMPLE = /^[A-Za-z0-9 ]+$/;

test.describe("nomQrOrange", () => {
  test("accents retirés, exemples attendus", async () => {
    const { nomQrOrange, nomQrJetons, NOM_QR_FORMATION_CV } = await charger();
    expect(nomQrOrange("Achat de 10 jetons Facilité Marketplace")).toBe("Achat de 10 jetons F");
    expect(nomQrOrange("Formation Rédaction de CV Facilité")).toBe("Formation Redaction");
    expect(nomQrOrange("Éléphant à l'été, çà et là")).toBe("Elephant a lete ca e");
    expect(nomQrJetons(10)).toBe("Achat 10 jetons");
    expect(nomQrJetons(1)).toBe("Achat 1 jeton");
    expect(NOM_QR_FORMATION_CV).toBe("Formation CV");
  });

  test("lettres ligaturées (œ, æ, ß) converties", async () => {
    const { nomQrOrange } = await charger();
    expect(nomQrOrange("Cœur de bœuf")).toBe("Coeur de boeuf");
    expect(nomQrOrange("Straße")).toBe("Strasse");
  });

  test("caractères spéciaux et emojis retirés, espaces multiples réduits", async () => {
    const { nomQrOrange } = await charger();
    expect(nomQrOrange("Achat 🎉 10   jetons !!! <b>")).toBe("Achat 10 jetons b");
    expect(nomQrOrange("a\tb\n\nc")).toBe("a b c");
    expect(nomQrOrange("Café-Test_#1")).toBe("CafeTest1");
  });

  test("jamais plus de 20 caractères, même pour une entrée très longue, et jamais de blanc final", async () => {
    const { nomQrOrange } = await charger();
    for (const entree of ["x".repeat(5000), "Achat de 123456 jetons Facilité Marketplace", "abcdefghi jklmnopqrs tuv", "a ".repeat(500)]) {
      const nom = nomQrOrange(entree);
      expect(nom.length).toBeLessThanOrEqual(20);
      expect(nom).toBe(nom.trim());
      expect(nom).toMatch(ASCII_SIMPLE);
    }
    expect(nomQrOrange("abcdefghi jklmnopqrs tuv")).toBe("abcdefghi jklmnopqrs");
  });

  test("jamais vide : repli « Facilite »", async () => {
    const { nomQrOrange } = await charger();
    for (const entree of ["", "   ", null, undefined, "🎉🎉", "###", "éééé".replace(/é/g, "́")]) {
      expect(nomQrOrange(entree)).toBe("Facilite");
    }
    expect(nomQrOrange("", "Paiement")).toBe("Paiement");
  });

  test("quantités extrêmes : le nom des jetons reste valide", async () => {
    const { nomQrJetons } = await charger();
    for (const q of [1, 2, 10, 999999, 12345678901]) {
      const nom = nomQrJetons(q);
      expect(nom.length).toBeLessThanOrEqual(20);
      expect(nom).toMatch(ASCII_SIMPLE);
      expect(nom.length).toBeGreaterThan(0);
    }
  });
});

test.describe("le corps de la requête QR utilise ce nom", () => {
  async function corpsEnvoye(nom) {
    const sauvegarde = { fetch: global.fetch, env: { ...process.env } };
    process.env.ORANGE_MONEY_CLIENT_ID = "id";
    process.env.ORANGE_MONEY_CLIENT_SECRET = "secret";
    process.env.ORANGE_MONEY_MERCHANT_CODE = "629988";
    process.env.ORANGE_MONEY_API_BASE_URL = "https://api.orange-sonatel.com";
    let corps = null;
    global.fetch = async (url, init) => {
      if (String(url).endsWith("/oauth/v1/token")) return new Response(JSON.stringify({ access_token: "jeton", expires_in: 3600 }), { status: 200, headers: { "content-type": "application/json" } });
      corps = JSON.parse(init.body);
      return new Response(JSON.stringify({ qrId: "QR1", qrCode: "AAAA" }), { status: 200, headers: { "content-type": "application/json" } });
    };
    try {
      const { genererQrCodePaiement } = await import(`../../src/lib/orangeMoney.js?cas=${Math.random()}`);
      await genererQrCodePaiement({
        reference: "6f1d2a40-0000-4000-8000-000000000001",
        montantXof: 1000,
        nom,
        validiteSecondes: 900,
        callbackSuccessUrl: "https://ffacilite.com/premium?statut=succes",
        callbackCancelUrl: "https://ffacilite.com/premium?statut=annule",
        callbackUrl: "https://ffacilite.com/api/pay/jetons-webhook?t=x",
      });
    } finally {
      global.fetch = sauvegarde.fetch;
      for (const k of Object.keys(process.env)) if (!(k in sauvegarde.env)) delete process.env[k];
      Object.assign(process.env, sauvegarde.env);
    }
    return corps;
  }

  test("achat de jetons et formation CV : name court, ASCII, 20 caractères au plus", async () => {
    const { nomQrJetons, NOM_QR_FORMATION_CV } = await charger();
    const jetons = await corpsEnvoye(nomQrJetons(10));
    const formation = await corpsEnvoye(NOM_QR_FORMATION_CV);
    expect(jetons.name).toBe("Achat 10 jetons");
    expect(formation.name).toBe("Formation CV");
    for (const c of [jetons, formation]) {
      expect(c.name).toMatch(ASCII_SIMPLE);
      expect(c.name.length).toBeLessThanOrEqual(20);
    }
  });

  test("même un ancien libellé long et accentué est simplifié avant l'envoi à Orange", async () => {
    const corps = await corpsEnvoye("Achat de 10 jetons Facilité Marketplace");
    expect(corps.name).toBe("Achat de 10 jetons F");
    expect(corps.name.length).toBeLessThanOrEqual(20);
  });

  test("les deux routes de paiement utilisent les noms simplifiés, plus de libellé long ni accentué", () => {
    const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");
    const jetons = lire("src/app/api/pay/jetons-checkout/route.js");
    const formation = lire("src/app/api/pay/formation-cv-checkout/route.js");
    expect(jetons).toContain("nom: nomQrJetons(quantiteJetons)");
    expect(formation).toContain("nom: NOM_QR_FORMATION_CV");
    expect(jetons).not.toContain("Facilité Marketplace");
    expect(formation).not.toContain("Rédaction de CV Facilité");
  });
});
