// Changement du code PIN du compte marchand Orange Money (API « Mobile Money Account » / changePinCode).
//
// ÉTAT : PRÊT, NON EXÉCUTÉ. Lancé sans option, le script ne fait AUCUN appel réseau : il vérifie la configuration et
// affiche ce qu'il ferait (mode « à blanc »). Il n'appelle changePinCode qu'avec --confirmer, après le feu vert explicite
// du propriétaire : un PIN changé par erreur peut bloquer le compte.
//
// Étapes (--confirmer) : 1) jeton OAuth2 · 2) récupération de la clé publique (« Get public key ») ·
// 3) chiffrement du nouveau PIN avec cette clé · 4) appel changePinCode.
//
// Le nouveau PIN est lu UNIQUEMENT dans OM_NEW_PIN (.env.local) : jamais en argument de ligne de commande (visible dans la
// liste des processus), jamais affiché, jamais journalisé — ni lui, ni le texte chiffré, ni la clé, ni les corps de réponse.
//
// Les chemins d'API et l'algorithme de chiffrement ci-dessous n'ont PAS pu être relus dans la documentation du portail
// (rendue côté navigateur, illisible hors connexion) : ils ne sont donc PAS codés en dur ici. Il faut les renseigner dans
// .env.local d'après la rubrique « Mobile Money Account » avant tout --confirmer :
//   OM_PUBKEY_PATH       chemin de « Get public key » (ex. /api/…), obligatoire
//   OM_PUBKEY_FIELD      champ de la réponse qui contient la clé (défaut : publicKey)
//   OM_CHANGEPIN_PATH    chemin de changePinCode, obligatoire
//   OM_CHANGEPIN_BODY    gabarit JSON du corps, où {PIN_CHIFFRE} sera remplacé (ex. {"newPin":"{PIN_CHIFFRE}"}), obligatoire
//   OM_PIN_PADDING       oaep-sha256 | oaep-sha1 | pkcs1 — obligatoire, selon la doc
//   OM_CHANGEPIN_METHOD  POST | PUT (défaut : POST)
//
// Usage : node --env-file=.env.local scripts/orange-money-change-pin.mjs [--confirmer]
import crypto from "node:crypto";

const confirmer = process.argv.includes("--confirmer");
const SANDBOX = "https://api.sandbox.orange-sonatel.com";
const base = process.env.ORANGE_MONEY_API_BASE_URL || SANDBOX;

function exige(nom) {
  const v = process.env[nom];
  if (!v) return null;
  return v;
}

const config = {
  OM_NEW_PIN: exige("OM_NEW_PIN"),
  ORANGE_MONEY_CLIENT_ID: exige("ORANGE_MONEY_CLIENT_ID"),
  ORANGE_MONEY_CLIENT_SECRET: exige("ORANGE_MONEY_CLIENT_SECRET"),
  OM_PUBKEY_PATH: exige("OM_PUBKEY_PATH"),
  OM_CHANGEPIN_PATH: exige("OM_CHANGEPIN_PATH"),
  OM_CHANGEPIN_BODY: exige("OM_CHANGEPIN_BODY"),
  OM_PIN_PADDING: exige("OM_PIN_PADDING"),
};
const champCle = process.env.OM_PUBKEY_FIELD || "publicKey";
const methode = (process.env.OM_CHANGEPIN_METHOD || "POST").toUpperCase();
const manquants = Object.entries(config).filter(([, v]) => !v).map(([k]) => k);

console.log(`Environnement : ${process.env.OM_ENVIRONMENT || "(OM_ENVIRONMENT absent)"} — ${base}`);
console.log(manquants.length ? `Variables manquantes : ${manquants.join(", ")}` : "Variables : toutes présentes.");

if (config.OM_NEW_PIN && !/^\d{4}$/.test(config.OM_NEW_PIN)) {
  console.log("OM_NEW_PIN n'a pas la forme attendue (4 chiffres) — à vérifier dans la documentation Orange.");
}

if (!confirmer) {
  console.log("\nMode à blanc : aucun appel réseau effectué.");
  console.log("Ce que ferait --confirmer : jeton OAuth2 → GET clé publique → chiffrement du PIN → " + `${methode} changePinCode.`);
  process.exit(manquants.length ? 1 : 0);
}
if (manquants.length) {
  console.error("Arrêt : renseignez d'abord les variables manquantes (aucun appel effectué).");
  process.exit(1);
}

const paddings = {
  "oaep-sha256": { padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
  "oaep-sha1": { padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha1" },
  pkcs1: { padding: crypto.constants.RSA_PKCS1_PADDING },
};
if (!paddings[config.OM_PIN_PADDING]) {
  console.error("OM_PIN_PADDING inconnu (oaep-sha256 | oaep-sha1 | pkcs1). Arrêt, aucun appel effectué.");
  process.exit(1);
}

// Message d'erreur sûr : statut HTTP et code/message d'Orange, jamais le corps entier.
function erreurSure(etape, statut, donnees) {
  const code = donnees?.code ?? donnees?.errorCode ?? "";
  const msg = typeof donnees?.message === "string" ? donnees.message.slice(0, 200) : "";
  return `${etape} : échec (HTTP ${statut}${code ? `, code ${code}` : ""}${msg ? `, ${msg}` : ""}).`;
}

async function main() {
  // 1) Jeton OAuth2 (même flux que src/lib/orangeMoney.js)
  const rJeton = await fetch(`${base}/oauth/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.ORANGE_MONEY_CLIENT_ID,
      client_secret: config.ORANGE_MONEY_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });
  const dJeton = await rJeton.json().catch(() => ({}));
  if (!rJeton.ok || !dJeton.access_token) throw new Error(erreurSure("Jeton OAuth2", rJeton.status, dJeton));
  const auth = { Authorization: `Bearer ${dJeton.access_token}` };
  console.log("1/4 jeton OAuth2 obtenu.");

  // 2) Clé publique
  const rCle = await fetch(`${base}${config.OM_PUBKEY_PATH}`, { headers: auth });
  const dCle = await rCle.json().catch(() => ({}));
  const cleBrute = dCle?.[champCle];
  if (!rCle.ok || typeof cleBrute !== "string") throw new Error(erreurSure("Clé publique", rCle.status, dCle));
  // PEM complet, ou base64 DER (SPKI) nu : on accepte les deux.
  const pem = cleBrute.includes("BEGIN")
    ? cleBrute
    : `-----BEGIN PUBLIC KEY-----\n${cleBrute.replace(/\s+/g, "").match(/.{1,64}/g).join("\n")}\n-----END PUBLIC KEY-----`;
  console.log("2/4 clé publique récupérée.");

  // 3) Chiffrement du PIN
  const chiffre = crypto
    .publicEncrypt({ key: pem, ...paddings[config.OM_PIN_PADDING] }, Buffer.from(config.OM_NEW_PIN, "utf8"))
    .toString("base64");
  console.log("3/4 PIN chiffré.");

  // 4) changePinCode
  const corps = config.OM_CHANGEPIN_BODY.replace("{PIN_CHIFFRE}", chiffre);
  const rPin = await fetch(`${base}${config.OM_CHANGEPIN_PATH}`, {
    method: methode,
    headers: { ...auth, "Content-Type": "application/json" },
    body: corps,
  });
  const dPin = await rPin.json().catch(() => ({}));
  if (!rPin.ok) throw new Error(erreurSure("changePinCode", rPin.status, dPin));
  console.log(`4/4 changePinCode : accepté (HTTP ${rPin.status}).`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
