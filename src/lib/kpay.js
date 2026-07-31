/**
 * Client KPay (https://kpay.site) — passerelle de paiement mobile money
 * (Wave, Orange Money, MTN, etc.) pour l'achat de CV.
 *
 * Contrat d'API vérifié sur https://kpay.site/documentation/{paiements,
 * webhooks,authentification,erreurs} le 2026-07-31 : aucun champ ni endpoint
 * ci-dessous n'est deviné.
 *
 * Authentification : deux clés, toutes deux réservées au serveur. La
 * documentation KPay est explicite là-dessus ("elles ne voyagent que de
 * serveur à serveur") malgré le nom NEXT_PUBLIC_KPAY_PUBLIC_KEY — on ne
 * l'expose donc jamais côté client, uniquement lue ici (code serveur).
 */

const KPAY_API_BASE = "https://admin.kpay.site/api/v1";

function getKpayHeaders() {
  const apiKey = process.env.NEXT_PUBLIC_KPAY_PUBLIC_KEY;
  const secretKey = process.env.KPAY_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error(
      "[Configuration] NEXT_PUBLIC_KPAY_PUBLIC_KEY et/ou KPAY_SECRET_KEY manquants côté serveur."
    );
  }

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
