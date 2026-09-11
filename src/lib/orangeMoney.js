// Client Orange Money "Paiement Marchand" (QR code / deeplink) — abonnement
// Premium. Spécification obtenue directement du contact Orange Sonatel
// (Ndèye Fakhane Diop, OFMS) le 2026-09-11, PAS la documentation publique
// marketing de developer.orange.com (qui ne détaille aucun endpoint) :
// https://developer.orange-sonatel.com/documentation#tag/Merchant-Payment
//
// Flux réel (différent d'un webpay classique à redirection) : on génère un
// QR code + deux deeplinks (MAXIT, OM) affichés sur NOTRE page ; le client
// scanne/ouvre l'appli Orange Money de son côté ; la confirmation arrive de
// façon asynchrone sur notre webhook, jamais en réponse directe à l'appel
// d'initiation. Aucune saisie d'OTP sur notre page — ce n'était qu'une
// supposition initiale, corrigée par la doc réelle.
//
// Comme PayDunya/KPay (src/lib/paydunya.js, src/lib/kpay.js), les secrets
// sont lus ici en process.env brut, jamais centralisés dans src/lib/env.js
// (réservé aux deux variables Supabase qui doivent faire échouer le
// démarrage) : chaque fonction ci-dessous vérifie elle-même ce dont elle a
// besoin et lève une erreur explicite plutôt que d'échouer silencieusement
// sur un fetch avec des identifiants vides.
//
// Volontairement toujours SANDBOX pour l'instant (voir le "point 5" de la
// demande) : ORANGE_MONEY_API_BASE_URL n'est PAS dérivée de NODE_ENV comme
// PayDunya — une bascule vers la production doit être un choix explicite
// (changer la variable d'environnement), jamais un effet de bord d'un
// déploiement Vercel en production.
const SANDBOX_BASE_URL = "https://api.sandbox.orange-sonatel.com";

function baseUrl() {
  return process.env.ORANGE_MONEY_API_BASE_URL || SANDBOX_BASE_URL;
}

// Jeton OAuth2 mis en cache en mémoire de process — best effort seulement :
// une fonction serverless Vercel peut démarrer "à froid" sans ce cache,
// auquel cas un nouveau jeton est simplement redemandé. Le but est
// d'éviter de re-demander un jeton à CHAQUE requête sur une instance déjà
// "chaude", pas une garantie de partage entre instances (limite sandbox
// documentée : 60 req/min sur /oauth/v1/token).
let jetonCache = null; // { accessToken, expireLe }

async function obtenirJetonAcces() {
  const clientId = process.env.ORANGE_MONEY_CLIENT_ID;
  const clientSecret = process.env.ORANGE_MONEY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("ORANGE_MONEY_CLIENT_ID / ORANGE_MONEY_CLIENT_SECRET manquant(s).");
  }

  const MARGE_EXPIRATION_MS = 60_000;
  if (jetonCache && jetonCache.expireLe - Date.now() > MARGE_EXPIRATION_MS) {
    return jetonCache.accessToken;
  }

  const reponse = await fetch(`${baseUrl()}/oauth/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });

  const donnees = await reponse.json().catch(() => ({}));
  if (!reponse.ok || !donnees.access_token) {
    throw new Error(`Échec d'obtention du jeton Orange Money (${reponse.status}) : ${donnees.error_description || donnees.error || "réponse invalide"}.`);
  }

  jetonCache = {
    accessToken: donnees.access_token,
    expireLe: Date.now() + (Number(donnees.expires_in) || 3600) * 1000,
  };
  return jetonCache.accessToken;
}

/**
 * Génère un QR code / deeplinks de paiement marchand.
 *
 * `code` (le "code marchand" à 6 chiffres) est DISTINCT de
 * ORANGE_MONEY_CLIENT_ID — valeur encore à confirmer avec Orange au moment
 * d'écrire cette fonction (voir le "point 6" de la demande), lue ici via
 * ORANGE_MONEY_MERCHANT_CODE plutôt que codée en dur : tant que la variable
 * n'est pas renseignée, cette fonction échoue explicitement au lieu
 * d'envoyer une valeur inventée à l'API Orange.
 */
export async function genererQrCodePaiement({ reference, montantXof, nom, validiteSecondes = 900, callbackSuccessUrl, callbackCancelUrl, callbackUrl }) {
  const code = process.env.ORANGE_MONEY_MERCHANT_CODE;
  if (!code) {
    throw new Error("ORANGE_MONEY_MERCHANT_CODE manquant (code marchand à 6 chiffres, distinct du client_id OAuth2).");
  }

  const accessToken = await obtenirJetonAcces();

  const reponse = await fetch(`${baseUrl()}/api/eWallet/v4/qrcode`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Callback-Url": callbackUrl,
    },
    body: JSON.stringify({
      code,
      name: nom,
      amount: { value: montantXof, unit: "XOF" },
      validity: validiteSecondes,
      callbackSuccessUrl,
      callbackCancelUrl,
      reference,
    }),
  });

  const donnees = await reponse.json().catch(() => ({}));
  if (!reponse.ok || !donnees.qrId) {
    throw new Error(`Échec de génération du QR code Orange Money (${reponse.status}) : ${donnees.message || donnees.error || "réponse invalide"}.`);
  }

  return {
    qrId: donnees.qrId,
    qrCodeBase64: donnees.qrCode || null,
    deepLink: donnees.deepLink || null,
    deepLinkMaxit: donnees.deepLinks?.MAXIT || null,
    deepLinkOm: donnees.deepLinks?.OM || null,
    valideJusqua: donnees.validFor || null,
  };
}

/**
 * Repli en l'absence de webhook (le statut final est garanti sous 24h par
 * Orange) — utilisé par la route de statut interrogée par le frontend en
 * polling, jamais appelé automatiquement en tâche de fond ici.
 */
export async function obtenirStatutTransaction(transactionId) {
  const accessToken = await obtenirJetonAcces();
  const reponse = await fetch(`${baseUrl()}/api/eWallet/v1/transactions/${encodeURIComponent(transactionId)}/status`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const donnees = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    throw new Error(`Échec de lecture du statut Orange Money (${reponse.status}) : ${donnees.message || donnees.error || "réponse invalide"}.`);
  }
  return donnees;
}

const FENETRE_ANTI_REJEU_SECONDES = 300;

/**
 * Vérifie l'en-tête X-Sonatel-Signature d'un webhook : format
 * "t={timestamp},v1={hmac_hex}", hmac = HMAC_SHA256(secret,
 * "{t},{corpsBrut}"). `corpsBrut` DOIT être le corps de la requête tel que
 * reçu, avant tout JSON.parse — un corps re-sérialisé ne produirait pas le
 * même octet-à-octet et casserait la vérification silencieusement.
 *
 * `secret` est ORANGE_MONEY_WEBHOOK_SECRET (le "endpoint_secret"/apiKey de
 * l'enregistrement du callback, distinct de ORANGE_MONEY_CLIENT_SECRET
 * OAuth2 — encore à confirmer en testant, voir le "point 6" de la demande).
 */
export function verifierSignatureWebhook(corpsBrut, enTeteSignature, secret) {
  if (!enTeteSignature) return { valide: false, motif: "en-tête X-Sonatel-Signature absent" };

  const correspondance = /^t=(\d+),v1=([0-9a-f]+)$/i.exec(enTeteSignature.trim());
  if (!correspondance) return { valide: false, motif: "format d'en-tête inattendu" };

  const [, timestampTexte, signatureRecue] = correspondance;
  const timestamp = Number(timestampTexte);
  if (!Number.isFinite(timestamp)) return { valide: false, motif: "timestamp invalide" };

  const ecartSecondes = Math.abs(Date.now() / 1000 - timestamp);
  if (ecartSecondes > FENETRE_ANTI_REJEU_SECONDES) {
    return { valide: false, motif: `timestamp hors fenêtre anti-rejeu (${Math.round(ecartSecondes)}s d'écart)` };
  }

  const crypto = require("crypto");
  const signatureAttendue = crypto
    .createHmac("sha256", secret)
    .update(`${timestampTexte},${corpsBrut}`)
    .digest("hex");

  const bufAttendu = Buffer.from(signatureAttendue, "utf8");
  const bufRecu = Buffer.from(signatureRecue, "utf8");
  if (bufAttendu.length !== bufRecu.length || !crypto.timingSafeEqual(bufAttendu, bufRecu)) {
    return { valide: false, motif: "signature invalide" };
  }

  return { valide: true };
}
