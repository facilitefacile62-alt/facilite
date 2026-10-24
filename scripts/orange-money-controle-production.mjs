// Contrôle EN LECTURE SEULE de ce que notre application Orange Money a le droit d'appeler (sandbox ou production).
//
// Il n'écrit rien : il ne crée aucun paiement, ne change aucun PIN, n'enregistre aucun callback. Il n'envoie que des requêtes GET (et la
// demande de jeton OAuth) et n'affiche QUE les codes de réponse : 200 = autorisé · 401 « no apiproduct match » ou 403 = non autorisé
// pour notre application · 404 sur un identifiant bidon = autorisé (la ressource n'existe simplement pas).
// Aucune valeur secrète (jeton, clé, identifiants) n'est affichée.
//
// Usage :
//   node --env-file=.env.local scripts/orange-money-controle-production.mjs                  (sandbox, par défaut)
//   ORANGE_MONEY_API_BASE_URL=https://api.orange-sonatel.com node --env-file=.env.production.local scripts/orange-money-controle-production.mjs --production
// En production, le drapeau --production est OBLIGATOIRE (et les clés de production doivent être dans les variables d'environnement
// du terminal ou d'un fichier local ignoré par git : jamais dans le dépôt, jamais dans le chat).
const SANDBOX = "https://api.sandbox.orange-sonatel.com";
const PRODUCTION = "https://api.orange-sonatel.com";
const base = (process.env.ORANGE_MONEY_API_BASE_URL || SANDBOX).replace(/\/$/, "");
const estProduction = base === PRODUCTION;

if (estProduction && !process.argv.includes("--production")) {
  console.error("Production détectée : relancer avec --production pour confirmer que c'est voulu (lecture seule).");
  process.exit(1);
}
for (const nom of ["ORANGE_MONEY_CLIENT_ID", "ORANGE_MONEY_CLIENT_SECRET"]) {
  if (!process.env[nom]) {
    console.error(`Variable manquante : ${nom}`);
    process.exit(1);
  }
}

console.log(`Environnement : ${estProduction ? "PRODUCTION" : "SANDBOX"} — ${base}\n`);

const reponseJeton = await fetch(`${base}/oauth/v1/token`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ client_id: process.env.ORANGE_MONEY_CLIENT_ID, client_secret: process.env.ORANGE_MONEY_CLIENT_SECRET, grant_type: "client_credentials" }),
});
const jeton = (await reponseJeton.json().catch(() => ({}))).access_token;
console.log(`POST /oauth/v1/token                                  -> ${reponseJeton.status} ${jeton ? "(jeton obtenu)" : "(AUCUN jeton : clés refusées ?)"}`);
if (!jeton) process.exit(1);

const IDENTIFIANT_BIDON = "MP000000.0000.A00000"; // 20 caractères, n'existe pas
const sondes = [
  ["GET /api/account/v1/publicKeys (clé publique)", "/api/account/v1/publicKeys"],
  ["GET /api/notification/v1/merchantcallback", "/api/notification/v1/merchantcallback"],
  [`GET /api/eWallet/v1/transactions/{id}/status (bidon)`, `/api/eWallet/v1/transactions/${IDENTIFIANT_BIDON}/status`],
  ["GET /api/eWallet/v1/transactions (recherche)", "/api/eWallet/v1/transactions?type=MERCHANT_PAYMENT&reference=controle-lecture-seule&page=0&size=1"],
];
for (const [libelle, chemin] of sondes) {
  const r = await fetch(`${base}${chemin}`, { headers: { Authorization: `Bearer ${jeton}` } });
  const corps = await r.json().catch(() => ({}));
  const verdict = r.status === 200 ? "autorisé" : r.status === 404 ? "autorisé (ressource inexistante, normal)" : r.status === 401 || r.status === 403 ? "NON AUTORISÉ pour cette application" : r.status === 429 ? "limite de requêtes atteinte, réessayer" : "à examiner";
  console.log(`${libelle.padEnd(54)} -> ${r.status}${corps?.code ? ` (code ${corps.code})` : ""} · ${verdict}`);
}
console.log("\nTerminé : lecture seule, rien n'a été écrit ni modifié chez Orange.");
