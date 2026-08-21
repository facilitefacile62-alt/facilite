/**
 * Client KPay (https://kpay.site) — passerelle de paiement mobile money
 * (Wave, Orange Money, MTN, etc.) pour l'achat de CV.
 *
 * Contrat d'API vérifié sur https://kpay.site/documentation/{paiements,
 * webhooks,authentification,erreurs} le 2026-07-31 : aucun champ ni endpoint
 * ci-dessous n'est deviné.
 *
 * Authentification : deux clés. KPAY_SECRET_KEY (X-Secret-Key) ne quitte
 * jamais le serveur — lue uniquement ici et dans les routes API, absente de
 * tout code client. NEXT_PUBLIC_KPAY_PUBLIC_KEY (X-API-Key) est en revanche
 * légitimement exposée côté client (voir src/lib/kpayClientInfo.js) : c'est
 * une clé publique au sens Stripe/publishable key, faite pour ça malgré le
 * terme "clé API" — seule KPAY_SECRET_KEY doit rester secrète.
 */

const KPAY_API_BASE = "https://admin.kpay.site/api/v1";

/**
 * XOF (Sénégal, zone UEMOA) et XAF (zone CEMAC) sont deux codes ISO
 * distincts pour deux monnaies "franc CFA" différentes, mais toutes deux
 * historiquement arrimées au même taux fixe (655.957 pour 1 EUR) — 1 XOF
 * vaut donc exactement 1 XAF en pratique. Le compte marchand KPay utilisé
 * ici règle en XAF alors que Facilite enregistre ses commandes en XOF
 * (marché sénégalais) : sans cette équivalence, une comparaison de devise
 * stricte rejetterait à tort des paiements par ailleurs corrects.
 */
const CFA_FRANC_CURRENCIES = ["XOF", "XAF"];

export function isEquivalentCfaCurrency(currencyA, currencyB) {
  if (!currencyA || !currencyB) return false;
  const a = currencyA.toUpperCase();
  const b = currencyB.toUpperCase();
  if (a === b) return true;
  return CFA_FRANC_CURRENCIES.includes(a) && CFA_FRANC_CURRENCIES.includes(b);
}

/** Normalise un code devise franc CFA vers XOF, la devise de référence de
 * Facilite — les devises non-CFA sont renvoyées inchangées. */
export function normalizeCfaCurrency(currency) {
  if (!currency) return currency;
  return CFA_FRANC_CURRENCIES.includes(currency.toUpperCase()) ? "XOF" : currency;
}

/**
 * Valeurs de substitution connues (celle du .env.example fourni par
 * l'utilisateur, plus quelques variantes usuelles) — permet de distinguer
 * "pas encore configuré" d'un vrai secret, pour émettre une alerte claire
 * plutôt que de laisser échouer silencieusement chaque vérification de
 * signature sans explication.
 */
const PLACEHOLDER_SECRET_VALUES = ["ton_webhook_secret_ici", "your_webhook_secret_here", "changeme", "todo"];

export function isPlaceholderKpaySecret(value) {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return PLACEHOLDER_SECRET_VALUES.includes(normalized) || normalized.length < 16;
}

/**
 * Garde-fou de bascule en production : si NODE_ENV=production tourne encore
 * avec des clés kpay_test_/sk_test_, tous les paiements passent par le
 * sandbox KPay et aucun ne débite réellement le client — une confusion
 * classique et coûteuse à diagnostiquer sans ce signal explicite.
 */
function warnIfSandboxKeysInProduction(apiKey) {
  if (process.env.NODE_ENV === "production" && apiKey?.startsWith("kpay_test_")) {
    console.error(
      "[KPay] ALERTE : clés SANDBOX (kpay_test_...) utilisées alors que NODE_ENV=production. " +
        "Aucun paiement réel ne sera traité tant que les clés kpay_live_/sk_live_ du tableau de bord KPay " +
        "n'auront pas été renseignées dans les variables d'environnement de production."
    );
  }
}

function getKpayHeaders() {
  const apiKey = process.env.NEXT_PUBLIC_KPAY_PUBLIC_KEY;
  const secretKey = process.env.KPAY_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error(
      "[Configuration] NEXT_PUBLIC_KPAY_PUBLIC_KEY et/ou KPAY_SECRET_KEY manquants côté serveur."
    );
  }

  warnIfSandboxKeysInProduction(apiKey);

  return {
    "X-API-Key": apiKey,
    "X-Secret-Key": secretKey,
    "Content-Type": "application/json",
  };
}

/**
 * Initialise un paiement en mode "Gateway" (page de paiement hébergée par
 * KPay — le client y choisit lui-même son opérateur Wave/Orange Money/MTN,
 * on n'a donc pas à le spécifier ici, contrairement au mode USSD).
 *
 * @param {object} params
 * @param {number} params.amount - Montant en unité entière de la devise du
 *   compte marchand (pas de sous-unité à gérer, contrairement à Paystack).
 * @param {string} params.currency - Devise du montant (ex. "XOF") —
 *   obligatoire côté API KPay en mode GATEWAY depuis le 21/08 ("Le champ
 *   \"currency\" est obligatoire..."), absente jusqu'ici de cet appel :
 *   tout paiement KPay échouait en 502 avant même d'atteindre la page de
 *   paiement.
 * @param {string} params.externalId - Identifiant unique côté Facilite
 *   (l'id de la commande Supabase) — renvoyé tel quel dans le webhook.
 * @param {string} params.returnUrl - Redirection après paiement réussi.
 * @param {string} params.cancelUrl - Redirection si le client abandonne.
 * @param {string} [params.description]
 * @param {object} [params.metadata]
 * @returns {Promise<{id: string, gatewayUrl: string, expiresAt: string}>}
 */
export async function initKpayGatewayPayment({
  amount,
  currency,
  externalId,
  returnUrl,
  cancelUrl,
  description,
  metadata,
}) {
  const res = await fetch(`${KPAY_API_BASE}/payments/init`, {
    method: "POST",
    headers: getKpayHeaders(),
    body: JSON.stringify({
      amount,
      currency,
      externalId,
      returnUrl,
      cancelUrl,
      description,
      metadata,
    }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.gatewayUrl) {
    const message = data?.message || `Échec de l'initialisation du paiement KPay (HTTP ${res.status}).`;
    throw new Error(message);
  }

  return { id: data.id, gatewayUrl: data.gatewayUrl, expiresAt: data.expiresAt };
}

/**
 * Consulte le statut d'un paiement directement auprès de KPay — utile en
 * filet de sécurité : la documentation KPay ne spécifiant aucun mécanisme de
 * signature pour son "gateway return" (redirection navigateur, contrairement
 * au vrai webhook serveur-à-serveur qui lui est signé), on ne doit jamais
 * marquer une commande payée sur la seule foi d'un paramètre d'URL au retour
 * du client — uniquement sur le webhook signé, éventuellement recoupé ici.
 */
export async function getKpayPaymentStatus(paymentId) {
  const res = await fetch(`${KPAY_API_BASE}/payments/${paymentId}`, {
    method: "GET",
    headers: getKpayHeaders(),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.message || `Impossible de récupérer le statut du paiement KPay (HTTP ${res.status}).`);
  }

  return data;
}
