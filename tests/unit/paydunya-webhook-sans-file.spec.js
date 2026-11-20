const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * RabbitMQ / amqplib retirés (20/11/2026). La file et ses workers n'ont jamais été hébergés (0 consommateur sur les 4 files,
 * aucune commande payée par PayDunya en base). Le webhook PayDunya reste en place : il authentifie, confirme auprès de
 * PayDunya, journalise et répond, SANS file. KPay (processeur par défaut) n'en dépend pas.
 */
const racine = path.join(__dirname, "../..");
const lire = (p) => fs.readFileSync(path.join(racine, p), "utf8").replace(/\r\n/g, "\n");
const existe = (p) => fs.existsSync(path.join(racine, p));

test("la file de messages et ses workers ont disparu, ainsi que la dépendance et ses scripts", () => {
  for (const p of ["src/lib/rabbitmq.js", "src/lib/queueProducers.js", "src/workers", "docker-compose.rabbitmq.yml"]) {
    expect(existe(p), p).toBe(false);
  }
  const pkg = JSON.parse(lire("package.json"));
  expect(pkg.dependencies.amqplib).toBeUndefined();
  expect(pkg.devDependencies["@types/amqplib"]).toBeUndefined();
  expect(Object.keys(pkg.scripts).filter((s) => s.startsWith("worker"))).toEqual([]);
  const lock = JSON.parse(lire("package-lock.json"));
  expect(lock.packages["node_modules/amqplib"]).toBeUndefined();
  expect(lock.packages["node_modules/@types/amqplib"]).toBeUndefined();
});

test("aucun fichier de src n'importe plus amqplib, rabbitmq ou queueProducers", () => {
  const trouves = [];
  const parcourir = (dossier) => {
    for (const nom of fs.readdirSync(path.join(racine, dossier), { withFileTypes: true })) {
      const rel = `${dossier}/${nom.name}`;
      if (nom.isDirectory()) parcourir(rel);
      else if (/\.(js|jsx|mjs|ts|tsx)$/.test(nom.name) && /(from|require\()\s*["'](amqplib|@\/lib\/(rabbitmq|queueProducers)|\.\/(rabbitmq|queueProducers))/.test(lire(rel))) trouves.push(rel);
    }
  };
  parcourir("src");
  expect(trouves).toEqual([]);
});

test("webhook PayDunya : même contrôle d'entrée, journal, alerte critique seulement pour un paiement encaissé, réponse 200 sans file", () => {
  const r = lire("src/app/api/pay/paydunya-webhook/route.js");
  // contrôles conservés
  expect(r).toContain("verifyPayDunyaHash(signature)");
  expect(r).toContain('{ error: "Invalid signature" }, { status: 401 }');
  expect(r).toContain("confirmPayDunyaInvoice(invoiceToken)");
  expect(r).toContain('{ error: "Confirmation failed" }, { status: 502 }');
  // plus de file
  const codeSansCommentaires = r.replace(/\/\/.*$/gm, "");
  expect(codeSansCommentaires).not.toMatch(/enqueue|rabbit|amqp/i);
  // journal + alerte critique uniquement si le statut confirmé est « completed »
  expect(r).toContain("AUCUN traitement automatique");
  expect(r).toMatch(/if \(confirmedStatus === "completed"\) \{\s*\n[^\n]*\n\s*captureCriticalPaymentError\(/);
  // réponse propre
  expect(r).toContain("return NextResponse.json({ received: true, eventId, processed: false });");
});

test("KPay n'est pas touché : son webhook n'a aucun lien avec la file, et c'est toujours le processeur par défaut", () => {
  const k = lire("src/app/api/pay/kpay-webhook/route.js");
  expect(k).not.toMatch(/rabbit|amqp|queueProducers|enqueue/i);
  expect(lire("src/app/api/pay/checkout/route.js")).toContain('z.enum(["kpay", "paydunya"]).optional().default("kpay")');
});
