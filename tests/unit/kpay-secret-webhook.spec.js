const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const racine = path.resolve(__dirname, "../..");
const lire = (p) => fs.readFileSync(path.join(racine, p), "utf-8");

// Le seuil n'est écrit qu'à un seul endroit (src/lib/kpay.js) : ces tests le suivent, pour qu'on puisse l'abaisser sans les retoucher.
test("un secret KPay absent, d'exemple ou plus court que le seuil est refusé, avec un message clair", async () => {
  const { problemeSecretWebhookKpay, KPAY_WEBHOOK_SECRET_LONGUEUR_MIN: min } = await import("../../src/lib/kpay.js");
  expect(Number.isInteger(min) && min > 1).toBe(true);
  expect(problemeSecretWebhookKpay(undefined)).toContain("vide ou absent");
  expect(problemeSecretWebhookKpay("   ")).toContain("vide ou absent");
  expect(problemeSecretWebhookKpay("your_webhook_secret_here")).toContain("valeur d'exemple");
  expect(problemeSecretWebhookKpay("a".repeat(min - 1))).toContain(`moins de ${min} caractères`);
  // Les espaces autour ne comptent pas dans la longueur.
  expect(problemeSecretWebhookKpay(`  ${"a".repeat(min - 1)}  `)).toContain(`moins de ${min} caractères`);
  expect(problemeSecretWebhookKpay("a".repeat(min))).toBeNull();
});

test("le message ne reprend jamais la valeur du secret", async () => {
  const { problemeSecretWebhookKpay, KPAY_WEBHOOK_SECRET_LONGUEUR_MIN: min } = await import("../../src/lib/kpay.js");
  const secret = "Zq9-".repeat(min).slice(0, min - 1);
  expect(problemeSecretWebhookKpay(secret)).not.toContain(secret);
});

test("la route du webhook refuse (503) avant de lire le corps et de vérifier la signature", () => {
  const route = lire("src/app/api/pay/kpay-webhook/route.js");
  const refus = route.indexOf("problemeSecretWebhookKpay(secret)");
  expect(refus).toBeGreaterThan(-1);
  const bloc = route.slice(refus, route.indexOf("const rawBody = await req.text()", refus));
  expect(bloc).toContain("status: 503");
  expect(bloc).toContain("return NextResponse.json");
  expect(route.indexOf("isValidKpaySignature(rawBody", refus)).toBeGreaterThan(refus);
});
