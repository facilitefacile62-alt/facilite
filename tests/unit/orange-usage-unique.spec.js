const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Le QR est créé « à usage unique » : le corps de la requête à Orange contient restrictions.isSingleUse = true, pour les jetons ET la formation
 * CV (les deux passent par genererQrCodePaiement). Rien d'autre ne change : nom, validité de 300 s, montant, adresses.
 */
const charger = () => import("../../src/lib/orangeMoney.js");
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");

async function corpsEnvoye(nom) {
  const sauvegarde = { fetch: global.fetch, env: { ...process.env } };
  process.env.ORANGE_MONEY_CLIENT_ID = "id";
  process.env.ORANGE_MONEY_CLIENT_SECRET = "secret";
  process.env.ORANGE_MONEY_MERCHANT_CODE = "629988";
  process.env.ORANGE_MONEY_API_BASE_URL = "https://api.orange-sonatel.com";
  let corps = null;
  global.fetch = async (url, init) => {
    if (String(url).endsWith("/oauth/v1/token")) return new Response(JSON.stringify({ access_token: `j-${Math.random()}`, expires_in: 3600 }), { status: 200, headers: { "content-type": "application/json" } });
    corps = JSON.parse(init.body);
    return new Response(JSON.stringify({ qrId: "QR1", qrCode: "AAAA" }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const { genererQrCodePaiement, QR_VALIDITE_SECONDES } = await import(`../../src/lib/orangeMoney.js?cas=${Math.random()}`);
    await genererQrCodePaiement({
      reference: "6f1d2a40-0000-4000-8000-000000000001",
      montantXof: 1000,
      nom,
      validiteSecondes: QR_VALIDITE_SECONDES,
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

test.describe("QR à usage unique", () => {
  test("jetons ET formation CV : restrictions.isSingleUse = true, le reste de la requête est inchangé", async () => {
    const { nomQrJetons, NOM_QR_FORMATION_CV } = await charger();
    const jetons = await corpsEnvoye(nomQrJetons(10));
    const formation = await corpsEnvoye(NOM_QR_FORMATION_CV);
    for (const c of [jetons, formation]) {
      expect(c.restrictions).toEqual({ isSingleUse: true });
      expect(c.validity).toBe(300);
      expect(c.amount).toEqual({ value: 1000, unit: "XOF" });
      expect(c.code).toBe("629988");
      expect(c.callbackSuccessUrl).toBe("https://ffacilite.com/premium?statut=succes");
      expect(c.callbackCancelUrl).toBe("https://ffacilite.com/premium?statut=annule");
      expect(Object.keys(c).sort()).toEqual(["amount", "callbackCancelUrl", "callbackSuccessUrl", "code", "name", "reference", "restrictions", "validity"]);
    }
    expect(jetons.name).toBe("Achat 10 jetons");
    expect(formation.name).toBe("Formation CV");
  });

  test("les deux routes de paiement passent par genererQrCodePaiement (un seul endroit envoie le champ) et ne le redéfinissent pas", () => {
    for (const f of ["src/app/api/pay/jetons-checkout/route.js", "src/app/api/pay/formation-cv-checkout/route.js"]) {
      const s = lire(f);
      expect(s).toContain("genererQrCodePaiement({");
      expect(s).not.toMatch(/isSingleUse|restrictions/);
    }
    expect(lire("src/lib/orangeMoney.js").match(/isSingleUse: true/g)).toHaveLength(1);
  });
});
