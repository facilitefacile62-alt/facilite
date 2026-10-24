// Changement du code PIN d'un compte Orange Money par l'API (documentation officielle Orange Money API v1.1.0).
//
// Chemins documentés : jeton POST /oauth/v1/token · clé publique GET /api/account/v1/publicKeys (champs key, keyId, keySize, keyType)
// · changement PATCH /api/eWallet/v1/account?msisdn=…&type=customer|retailer, corps { encryptedPinCode (actuel), encryptedNewPinCode
// (nouveau) } · lecture de solde (sans effet) POST /api/eWallet/v1/account/customer/balance. Les PIN sont chiffrés en RSA avec la clé
// publique puis encodés en Base64 (344 caractères pour une clé de 2048 bits). La documentation ne dit PAS quel bourrage RSA utiliser :
// le script le détecte (PKCS#1 v1.5, puis OAEP SHA-1, puis OAEP SHA-256) avec un appel de solde sans effet — 4003 = déchiffrement
// impossible, 2011 / 2012 / 2013 = PIN erroné (le chiffrement est donc bon). Code 4003 au changement : redemander la clé publique.
//
// SÉCURITÉ
//  - Aucun PIN, jeton, secret, clé ou texte chiffré n'est affiché, journalisé ni écrit dans un fichier. Les PIN sont saisis au clavier
//    SANS écho (ou, hors terminal, lus dans OM_CURRENT_PIN / OM_NEW_PIN du fichier .env.local, ignoré par git) ; jamais en argument.
//  - Sans option, le script ne fait AUCUN appel réseau (mode à blanc). Un vrai changement exige --confirmer.
//  - Sur la PRODUCTION (ORANGE_MONEY_API_BASE_URL = https://api.orange-sonatel.com) il exige en plus --production. Par défaut : SANDBOX.
//
// Usage :
//   node --env-file=.env.local scripts/orange-money-change-pin.mjs                      (à blanc)
//   node --env-file=.env.local scripts/orange-money-change-pin.mjs --sandbox-essai      (SANDBOX : numéros de test d'Orange, PIN d'essai
//                                                                                        changé puis RESTAURÉ ; rien d'autre n'est touché)
//   node --env-file=.env.local scripts/orange-money-change-pin.mjs --confirmer [--production]   (vrai changement : OM_MSISDN, OM_TYPE)
import crypto from "node:crypto";
import readline from "node:readline";

const SANDBOX = "https://api.sandbox.orange-sonatel.com";
const PRODUCTION = "https://api.orange-sonatel.com";
const base = (process.env.ORANGE_MONEY_API_BASE_URL || SANDBOX).replace(/\/$/, "");
const confirmer = process.argv.includes("--confirmer");
const essaiSandbox = process.argv.includes("--sandbox-essai");
const production = process.argv.includes("--production");
const estProduction = base === PRODUCTION;

async function fetchOm(chemin, init = {}) {
  const reponse = await fetch(`${base}${chemin}`, init);
  const donnees = await reponse.json().catch(() => ({}));
  return { statut: reponse.status, donnees };
}

async function jeton() {
  const { statut, donnees } = await fetchOm("/oauth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.ORANGE_MONEY_CLIENT_ID, client_secret: process.env.ORANGE_MONEY_CLIENT_SECRET, grant_type: "client_credentials" }),
  });
  if (statut !== 200 || !donnees.access_token) throw new Error(`Jeton refusé (HTTP ${statut}).`);
  return donnees.access_token;
}

async function clePublique(token) {
  const { statut, donnees } = await fetchOm("/api/account/v1/publicKeys", { headers: { Authorization: `Bearer ${token}` } });
  if (statut !== 200 || !donnees.key) throw new Error(`Clé publique indisponible (HTTP ${statut}).`);
  const pem = `-----BEGIN PUBLIC KEY-----\n${String(donnees.key).match(/.{1,64}/g).join("\n")}\n-----END PUBLIC KEY-----\n`;
  return { pem, keyId: donnees.keyId };
}

const BOURRAGES = {
  pkcs1: { padding: crypto.constants.RSA_PKCS1_PADDING },
  "oaep-sha1": { padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha1" },
  "oaep-sha256": { padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
};
function chiffrer(pin, pem, bourrage) {
  return crypto.publicEncrypt({ key: pem, ...BOURRAGES[bourrage] }, Buffer.from(pin, "utf8")).toString("base64");
}

/** Lecture de solde client (sans effet) : sert à vérifier le chiffrement. Renvoie le statut HTTP et le code d'erreur Orange éventuel. */
async function essaiSolde(token, msisdn, pin, pem, bourrage) {
  const { statut, donnees } = await fetchOm("/api/eWallet/v1/account/customer/balance", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ idType: "MSISDN", id: msisdn, encryptedPinCode: chiffrer(pin, pem, bourrage), wallet: "principal" }),
  });
  return { statut, code: donnees?.code ? String(donnees.code) : null };
}

async function detecterBourrage(token, msisdn, pin, pem) {
  for (const nom of Object.keys(BOURRAGES)) {
    const { statut, code } = await essaiSolde(token, msisdn, pin, pem, nom);
    if (statut === 200) return { nom, preuve: "solde lu" };
    if (code && ["2011", "2012", "2013"].includes(code)) return { nom, preuve: `PIN reconnu comme tel (code ${code}) : le chiffrement est accepté` };
  }
  return null;
}

async function changerPin({ token, msisdn, type, pinActuel, pinNouveau, pem, bourrage }) {
  return fetchOm(`/api/eWallet/v1/account?msisdn=${encodeURIComponent(msisdn)}&type=${type}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ encryptedPinCode: chiffrer(pinActuel, pem, bourrage), encryptedNewPinCode: chiffrer(pinNouveau, pem, bourrage) }),
  });
}

/** Saisie d'un PIN sans écho dans un terminal ; hors terminal, la variable d'environnement donnée. */
function saisirPin(question, variable) {
  if (!process.stdin.isTTY) return Promise.resolve(process.env[variable] || "");
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const ecrire = rl._writeToOutput;
    rl.question(question, (reponse) => {
      rl._writeToOutput = ecrire;
      rl.close();
      process.stdout.write("\n");
      resolve(reponse.trim());
    });
    rl._writeToOutput = (t) => (t.includes(question) ? ecrire.call(rl, t) : undefined);
  });
}

const resume = (r) => `HTTP ${r.statut}${r.donnees?.code ? ` · code ${r.donnees.code}` : ""}${r.donnees?.status ? ` · ${r.donnees.status}` : ""}`;

async function main() {
  console.log(`Environnement : ${estProduction ? "PRODUCTION" : "SANDBOX"} — ${base}`);
  const manquants = ["ORANGE_MONEY_CLIENT_ID", "ORANGE_MONEY_CLIENT_SECRET"].filter((n) => !process.env[n]);
  if (manquants.length) {
    console.log(`Variables manquantes : ${manquants.join(", ")}`);
    process.exit(1);
  }

  if (!confirmer && !essaiSandbox) {
    console.log("\nMode à blanc : aucun appel réseau effectué.");
    console.log("--sandbox-essai : SANDBOX seulement, numéros de test d'Orange (PIN d'essai changé puis restauré).");
    console.log("--confirmer     : vrai changement de PIN (OM_MSISDN, OM_TYPE=customer|retailer ; PIN saisis sans écho)." + (estProduction ? " Production : ajouter --production." : ""));
    return;
  }

  if (essaiSandbox) {
    if (estProduction) throw new Error("--sandbox-essai est interdit sur la production.");
    const token = await jeton();
    const sims = await fetchOm("/api/assignments/v1/partner/sim-cards?nbCustomers=1&nbMerchants=1", { headers: { Authorization: `Bearer ${token}` } });
    const liste = Array.isArray(sims.donnees) ? sims.donnees : [];
    const client = liste.find((s) => s.type === "CUSTOMER");
    const marchand = liste.find((s) => s.type === "MERCHANT");
    if (!client || !marchand) throw new Error(`Numéros de test indisponibles (HTTP ${sims.statut}).`);
    const { pem, keyId } = await clePublique(token);
    console.log(`Clé publique lue (keyId ${keyId}). Numéros de test : 1 client, 1 marchand (sandbox).`);

    const detecte = await detecterBourrage(token, client.msisdn, client.pinCode, pem);
    if (!detecte) throw new Error("Aucun bourrage RSA n'est accepté (4003 partout) : clé à redemander, ou bourrage non prévu.");
    console.log(`Bourrage RSA accepté par Orange : ${detecte.nom} (${detecte.preuve}).`);

    // Changement du PIN du MARCHAND de test vers un PIN d'essai aléatoire, puis restauration.
    const pinEssai = String(1000 + crypto.randomInt(0, 9000));
    const aller = await changerPin({ token, msisdn: marchand.msisdn, type: "retailer", pinActuel: marchand.pinCode, pinNouveau: pinEssai, pem, bourrage: detecte.nom });
    console.log(`Changement du PIN du marchand de test : ${resume(aller)}`);
    if (aller.statut === 200) {
      const retour = await changerPin({ token, msisdn: marchand.msisdn, type: "retailer", pinActuel: pinEssai, pinNouveau: marchand.pinCode, pem, bourrage: detecte.nom });
      console.log(`Restauration du PIN d'origine : ${resume(retour)}`);
    }
    return;
  }

  // Vrai changement.
  if (estProduction && !production) throw new Error("Production détectée : relancer avec --production pour confirmer explicitement.");
  const msisdn = process.env.OM_MSISDN || "";
  const type = process.env.OM_TYPE || "";
  if (!/^\d{9}$/.test(msisdn) || !["customer", "retailer"].includes(type)) throw new Error("OM_MSISDN (9 chiffres) et OM_TYPE (customer | retailer) sont requis dans .env.local.");
  const pinActuel = await saisirPin("PIN actuel (saisie masquée) : ", "OM_CURRENT_PIN");
  const pinNouveau = await saisirPin("Nouveau PIN (saisie masquée) : ", "OM_NEW_PIN");
  if (!/^\d{4}$/.test(pinActuel) || !/^\d{4}$/.test(pinNouveau)) throw new Error("Les PIN doivent avoir 4 chiffres.");
  if (pinActuel === pinNouveau) throw new Error("Le nouveau PIN doit être différent de l'actuel.");

  const token = await jeton();
  const { pem } = await clePublique(token);
  const bourrage = process.env.OM_PIN_PADDING && BOURRAGES[process.env.OM_PIN_PADDING] ? process.env.OM_PIN_PADDING : "pkcs1";
  let resultat = await changerPin({ token, msisdn, type, pinActuel, pinNouveau, pem, bourrage });
  if (resultat.donnees?.code === "4003") {
    // Clé révoquée ou invalide : on redemande la clé publique et on rejoue UNE fois.
    const neuve = await clePublique(token);
    resultat = await changerPin({ token, msisdn, type, pinActuel, pinNouveau, pem: neuve.pem, bourrage });
  }
  console.log(`Changement de PIN : ${resume(resultat)}`);
  if (resultat.statut !== 200) process.exitCode = 1;
}

main().catch((erreur) => {
  console.error(`Erreur : ${erreur.message}`);
  process.exit(1);
});
