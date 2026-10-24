const { test, expect } = require("@playwright/test");

/**
 * Journal d'un QR refusé par Orange : il doit montrer le statut HTTP, le code et le message d'Orange et la forme de la requête, mais
 * JAMAIS une clé, le jeton OAuth, le code marchand, ni le jeton du callback.
 */
const SECRET_CLIENT = "SECRET-CLIENT-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789";
const JETON_OAUTH = "JETON-OAUTH-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789-xyz";
const CODE_MARCHAND = "629988";
const JETON_CALLBACK = "JETONCALLBACK_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ab";

async function lancerAvecReponse(corps, statut = 500) {
  const sauvegarde = { fetch: global.fetch, erreur: console.error, env: { ...process.env } };
  const lignes = [];
  process.env.ORANGE_MONEY_CLIENT_ID = "id-client-test";
  process.env.ORANGE_MONEY_CLIENT_SECRET = SECRET_CLIENT;
  process.env.ORANGE_MONEY_MERCHANT_CODE = CODE_MARCHAND;
  process.env.ORANGE_MONEY_API_BASE_URL = "https://api.orange-sonatel.com";
  console.error = (...args) => lignes.push(args.join(" "));
  global.fetch = async (url) => {
    if (String(url).endsWith("/oauth/v1/token")) {
      return new Response(JSON.stringify({ access_token: JETON_OAUTH, expires_in: 3600 }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(corps, { status: statut, headers: { "content-type": "application/json", "x-request-id": "req-123" } });
  };
  let erreur;
  try {
    const { genererQrCodePaiement } = await import(`../../src/lib/orangeMoney.js?cas=${Math.random()}`);
    await genererQrCodePaiement({
      reference: "6f1d2a40-0000-4000-8000-000000000001",
      montantXof: 1000,
      nom: "Achat de 10 jetons Facilité Marketplace",
      validiteSecondes: 900,
      callbackSuccessUrl: "https://ffacilite.com/premium?statut=succes&commande=x",
      callbackCancelUrl: "https://ffacilite.com/premium?statut=annule&commande=x",
      callbackUrl: `https://ffacilite.com/api/pay/jetons-webhook?t=${JETON_CALLBACK}`,
    });
  } catch (e) {
    erreur = e;
  } finally {
    global.fetch = sauvegarde.fetch;
    console.error = sauvegarde.erreur;
    for (const k of Object.keys(process.env)) if (!(k in sauvegarde.env)) delete process.env[k];
    Object.assign(process.env, sauvegarde.env);
  }
  return { erreur, journal: lignes.join("\n") };
}

test.describe("journal d'un QR refusé", () => {
  test("code et message d'Orange visibles, aucun secret", async () => {
    const { erreur, journal } = await lancerAvecReponse(JSON.stringify({ code: "2010", message: "Please change your PIN code", token: JETON_OAUTH }));
    expect(erreur.codeOrange).toBe("2010");
    expect(journal).toContain('"http":500');
    expect(journal).toContain('"codeOrange":"2010"');
    expect(journal).toContain("Please change your PIN code");
    expect(journal).toContain("req-123");
    expect(journal).toContain('"codeMarchandLongueur":6');
    expect(journal).toContain('"codeMarchandCommencePar62":true');
    expect(journal).toContain('"callbackHttps":true');
    for (const secret of [SECRET_CLIENT, JETON_OAUTH, CODE_MARCHAND, JETON_CALLBACK, "Bearer"]) expect(journal).not.toContain(secret);
  });

  test("corps non JSON : un aperçu masqué est journalisé", async () => {
    const { journal } = await lancerAvecReponse(`<html>Internal Server Error ${JETON_OAUTH}</html>`);
    expect(journal).toContain("Internal Server Error");
    expect(journal).not.toContain(JETON_OAUTH);
  });

  test("le nom accentué est signalé (nomAscii=false) et l'adresse de callback n'est jamais journalisée en clair", async () => {
    const { journal } = await lancerAvecReponse(JSON.stringify({ message: `rejet de https://ffacilite.com/api/pay/jetons-webhook?t=${JETON_CALLBACK}` }));
    expect(journal).toContain('"nomAscii":false');
    expect(journal).not.toContain(JETON_CALLBACK);
  });
});
