const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const racine = path.resolve(__dirname, "../..");
const lire = (p) => fs.readFileSync(path.join(racine, p), "utf-8");

test("un secret KPay absent, d'exemple ou de moins de 32 caractères est refusé, avec un message clair", async () => {
  const { problemeSecretWebhookKpay, KPAY_WEBHOOK_SECRET_LONGUEUR_MIN } = await import("../../src/lib/kpay.js");
  expect(KPAY_WEBHOOK_SECRET_LONGUEUR_MIN).toBe(32);
  expect(problemeSecretWebhookKpay(undefined)).toContain("vide ou absent");
  expect(problemeSecretWebhookKpay("   ")).toContain("vide ou absent");
  expect(problemeSecretWebhookKpay("your_webhook_secret_here")).toContain("valeur d'exemple");
  expect(problemeSecretWebhookKpay("a".repeat(31))).toContain("moins de 32 caractères");
  // Les espaces autour ne comptent pas dans la longueur.
  expect(problemeSecretWebhookKpay(`  ${"a".repeat(31)}  `)).toContain("moins de 32 caractères");
  expect(problemeSecretWebhookKpay("a".repeat(32))).toBeNull();
});

test("le message ne reprend jamais la valeur du secret", async () => {
  const { problemeSecretWebhookKpay } = await import("../../src/lib/kpay.js");
  const secret = "valeur-courte-Zq9";
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
