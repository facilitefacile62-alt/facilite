// Essai de bout en bout Orange Money en SANDBOX, sans toucher à la base de données du site ni à la production.
//
// Deux modes, à lancer dans deux terminaux :
//   1) node scripts/orange-money-essai-sandbox.mjs recevoir
//        Petit récepteur local (port 8787) qui note, pour chaque notification d'Orange, les NOMS des en-têtes reçus (X-Sonatel-Signature ?
//        Authorization ? clé d'idempotence ?), la FORME du corps (champs, status, format de reference / partner.id / customer.id) et
//        l'heure d'arrivée. Aucune valeur secrète n'est écrite : les valeurs d'en-têtes ne sont jamais affichées. Il répond 202 (ou 500
//        avec --echec-une-fois, pour voir si Orange renvoie la notification après un 500).
//        Pour qu'Orange puisse l'atteindre, exposez-le en https avec un tunnel, par exemple :
//          cloudflared tunnel --url http://localhost:8787      (ou ngrok http 8787)
//   2) node --env-file=.env.local scripts/orange-money-essai-sandbox.mjs creer --callback=https://VOTRE-TUNNEL/notif [--montant=100]
//        Génère un QR code sandbox (référence = identifiant aléatoire), enregistre le QR en image dans le dossier temporaire, affiche les
//        liens d'application, puis interroge Orange (recherche par référence + statut) toutes les 10 s jusqu'à 20 minutes en notant chaque
//        changement de statut et le délai écoulé depuis la création.
//
// SANDBOX UNIQUEMENT : le script refuse de tourner si ORANGE_MONEY_API_BASE_URL pointe vers la production.
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const SANDBOX = "https://api.sandbox.orange-sonatel.com";
const base = (process.env.ORANGE_MONEY_API_BASE_URL || SANDBOX).replace(/\/$/, "");
if (base !== SANDBOX) {
  console.error("Ce script est réservé à la SANDBOX.");
  process.exit(1);
}
const mode = process.argv[2];
const option = (nom) => process.argv.find((a) => a.startsWith(`--${nom}=`))?.split("=").slice(1).join("=");
const heure = () => new Date().toISOString().slice(11, 23);

if (mode === "recevoir") {
  let echecUneFois = process.argv.includes("--echec-une-fois");
  http
    .createServer((req, res) => {
      const morceaux = [];
      req.on("data", (c) => morceaux.push(c));
      req.on("end", () => {
        console.log(`\n[${heure()}] ${req.method} ${req.url.split("?")[0]}   (paramètres d'URL présents : ${[...new URL(req.url, "http://x").searchParams.keys()].join(", ") || "aucun"})`);
        console.log(`  en-têtes (noms seulement) : ${Object.keys(req.headers).sort().join(", ")}`);
        console.log(`  X-Sonatel-Signature : ${req.headers["x-sonatel-signature"] ? "PRÉSENT" : "absent"} · Authorization : ${req.headers.authorization ? `présent (schéma ${req.headers.authorization.split(" ")[0]})` : "absent"}`);
        try {
          const j = JSON.parse(Buffer.concat(morceaux).toString("utf8"));
          const forme = (v) => (v === null || v === undefined ? "∅" : typeof v === "string" ? `texte(${v.length})${/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(v) ? " uuid" : ""}` : typeof v);
          console.log(`  corps : champs = ${Object.keys(j).join(", ")}`);
          console.log(`  status = ${j.status} · type = ${j.type} · paymentMethod = ${j.paymentMethod} · channel = ${j.channel}`);
          console.log(`  reference ${forme(j.reference)} · transactionId ${forme(j.transactionId)} (${String(j.transactionId || "").length} car.) · partner ${JSON.stringify({ idType: j.partner?.idType, id: forme(j.partner?.id) })} · customer ${JSON.stringify({ idType: j.customer?.idType, id: forme(j.customer?.id) })} · amount ${JSON.stringify(j.amount)}`);
        } catch {
          console.log("  corps non JSON");
        }
        if (echecUneFois) {
          echecUneFois = false;
          console.log("  → réponse 500 volontaire (pour voir si Orange renvoie)");
          res.writeHead(500).end();
        } else {
          res.writeHead(202).end();
        }
      });
    })
    .listen(8787, () => console.log("Récepteur prêt sur http://localhost:8787 — exposez-le en https (tunnel), puis lancez le mode « creer »."));
} else if (mode === "creer") {
  const callback = option("callback");
  const montant = Number(option("montant") || 100);
  if (!callback?.startsWith("https://")) {
    console.error("--callback=https://… est obligatoire (Orange refuse le http).");
    process.exit(1);
  }
  for (const n of ["ORANGE_MONEY_CLIENT_ID", "ORANGE_MONEY_CLIENT_SECRET", "ORANGE_MONEY_MERCHANT_CODE"]) {
    if (!process.env[n]) {
      console.error(`Variable manquante : ${n}`);
      process.exit(1);
    }
  }
  const jeton = (
    await (
      await fetch(`${base}/oauth/v1/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: process.env.ORANGE_MONEY_CLIENT_ID, client_secret: process.env.ORANGE_MONEY_CLIENT_SECRET, grant_type: "client_credentials" }),
      })
    ).json()
  ).access_token;
  const H = { Authorization: `Bearer ${jeton}` };
  const reference = crypto.randomUUID();
  const t0 = Date.now();
  const r = await fetch(`${base}/api/eWallet/v4/qrcode`, {
    method: "POST",
    headers: { ...H, "Content-Type": "application/json", "X-Callback-Url": callback },
    body: JSON.stringify({ code: process.env.ORANGE_MONEY_MERCHANT_CODE, name: "Essai sandbox Facilite", amount: { value: montant, unit: "XOF" }, validity: 900, reference, callbackSuccessUrl: "https://ffacilite.com/premium?statut=succes", callbackCancelUrl: "https://ffacilite.com/premium?statut=annule" }),
  });
  const qr = await r.json().catch(() => ({}));
  console.log(`QR code : HTTP ${r.status}${qr.code ? ` · code ${qr.code}` : ""}`);
  if (!r.ok) process.exit(1);
  const fichier = path.join(os.tmpdir(), `qr-orange-sandbox-${reference.slice(0, 8)}.png`);
  if (qr.qrCode) fs.writeFileSync(fichier, Buffer.from(qr.qrCode, "base64"));
  console.log(`référence de l'essai : ${reference}`);
  console.log(`QR (image) : ${fichier}`);
  console.log(`liens d'application : OM ${qr.deepLinks?.OM || "-"} · MAXIT ${qr.deepLinks?.MAXIT || "-"}`);
  console.log(`valide jusqu'à : ${qr.validFor?.endDateTime || "?"}\n`);
  console.log("Payez maintenant avec le numéro CLIENT de test (simulateur sandbox du portail Orange). Suivi toutes les 10 s :\n");

  let dernier = "";
  for (let i = 0; i < 120; i += 1) {
    const sec = Math.round((Date.now() - t0) / 1000);
    const q = new URLSearchParams({ reference, type: "MERCHANT_PAYMENT", page: "0", size: "5" });
    const rs = await fetch(`${base}/api/eWallet/v1/transactions?${q}`, { headers: H });
    const liste = await rs.json().catch(() => []);
    const ligne = Array.isArray(liste) && liste[0] ? liste[0] : null;
    let etat = ligne ? `recherche : ${ligne.status} · transactionId ${String(ligne.transactionId || "").length} car. · reference identique : ${ligne.reference === reference} · montant ${JSON.stringify(ligne.amount)}` : `recherche : HTTP ${rs.status}, aucune ligne`;
    if (ligne?.transactionId) {
      const st = await fetch(`${base}/api/eWallet/v1/transactions/${encodeURIComponent(ligne.transactionId)}/status`, { headers: H });
      etat += ` | statut : ${(await st.json().catch(() => ({}))).status ?? `HTTP ${st.status}`}`;
    }
    if (etat !== dernier) {
      console.log(`[+${String(sec).padStart(4)} s] ${etat}`);
      dernier = etat;
    }
    if (ligne && !["PENDING", "INITIATED", "PRE_INITIATED", "ACCEPTED"].includes(String(ligne.status).toUpperCase())) break;
    await new Promise((ok) => setTimeout(ok, 10_000));
  }
  console.log("\nFin du suivi.");
} else {
  console.log("Usage : voir l'en-tête du fichier. Modes : recevoir | creer --callback=https://…");
}
