/**
 * Client PayDunya (https://paydunya.com) — passerelle de paiement (Wave,
 * Orange Money, carte) pour la confection de CV et la recharge de crédits,
 * en complément de KPay (src/lib/kpay.js), pas en remplacement.
 *
 * Contrat d'API vérifié via le client Node.js officiel PayDunya
 * (github.com/paydunyadev/paydunya-node-master, lib/invoice.js et
 * lib/checkout-invoice.js) le 2026-08-21, la doc officielle
 * (developers.paydunya.com/doc/FR/http_json) renvoyant 403 depuis cet
 * environnement — même trois en-têtes d'authentification et mêmes noms de
 * champs de réponse (response_code/token/response_text) que ceux déjà en
 * service dans src/app/api/pay/paydunya-webhook/route.js pour la
 * confirmation, donc cohérent avec du code déjà éprouvé sur ce dépôt.
 */

/** Mêmes bases sandbox/production que confirmPayDunyaInvoice() dans
 * paydunya-webhook/route.js — jamais dupliquer une logique de bascule
 * différente entre la création et la confirmation d'une même facture. */
function getPayDunyaApiBase() {
  return process.env.NODE_ENV === "production"
    ? "https://app.paydunya.com/api/v1"
    : "https://app.paydunya.com/sandbox-api/v1";
}

function getPayDunyaHeaders() {
  const masterKey = process.env.PAYDUNYA_MASTER_KEY;
  const privateKey = process.env.PAYDUNYA_PRIVATE_KEY;
  const apiToken = process.env.PAYDUNYA_TOKEN;

  if (!masterKey || !privateKey || !apiToken) {
    throw new Error(
      "[Configuration] PAYDUNYA_MASTER_KEY/PAYDUNYA_PRIVATE_KEY/PAYDUNYA_TOKEN manquants côté serveur."
    );
  }

  if (process.env.NODE_ENV === "production" && privateKey.startsWith("test_")) {
    console.error(
      "[PayDunya] ALERTE : clé SANDBOX (test_...) utilisée alors que NODE_ENV=production. " +
        "Aucun paiement réel ne sera traité tant que les clés live du tableau de bord PayDunya " +
        "n'auront pas été renseignées dans les variables d'environnement de production."
    );
  }

  return {
    "Content-Type": "application/json",
    "PAYDUNYA-MASTER-KEY": masterKey,
    "PAYDUNYA-PRIVATE-KEY": privateKey,
    "PAYDUNYA-TOKEN": apiToken,
  };
}

/**
 * Crée une facture PayDunya et renvoie l'URL de paiement hébergée
 * (checkout-invoice/create) — le client y choisit lui-même Wave/Orange
 * Money/carte, comme le mode "Gateway" de KPay.
 *
 * @param {object} params
 * @param {number} params.amount - Montant en XOF (unité entière).
 * @param {string} params.externalId - Identifiant Facilite (orders.id ou
 *   transactions.id) — transmis en custom_data, jamais affiché au client,
 *   relisible uniquement via confirmPayDunyaInvoice() côté webhook.
 * @param {string} params.returnUrl - Redirection après paiement réussi.
 * @param {string} params.cancelUrl - Redirection si le client abandonne.
 * @param {string} params.callbackUrl - URL du webhook IPN (précisée par
 *   facture plutôt que de dépendre uniquement du réglage par défaut du
 *   tableau de bord PayDunya).
 * @param {string} [params.description]
 * @param {object} [params.metadata] - Fusionné dans custom_data.
 * @returns {Promise<{token: string, checkoutUrl: string}>}
 */
export async function createPayDunyaInvoiceCheckout({
  amount,
  externalId,
  returnUrl,
  cancelUrl,
  callbackUrl,
  description,
  metadata,
}) {
  const res = await fetch(`${getPayDunyaApiBase()}/checkout-invoice/create`, {
    method: "POST",
    headers: getPayDunyaHeaders(),
    body: JSON.stringify({
      invoice: {
        total_amount: amount,
        description,
      },
      store: {
        name: "Facilite",
      },
      actions: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
        callback_url: callbackUrl,
      },
      custom_data: { external_id: externalId, ...metadata },
    }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || data?.response_code !== "00" || !data?.token) {
    const message = data?.response_text || `Échec de la création de la facture PayDunya (HTTP ${res.status}).`;
    throw new Error(message);
  }

  return { token: data.token, checkoutUrl: data.response_text };
}
