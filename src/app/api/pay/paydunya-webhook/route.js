import { NextResponse } from "next/server";
import crypto from "crypto";
import { enqueueWebhookJob } from "@/lib/queueProducers";

/**
 * Filtre bon marché conforme à la doc officielle
 * (developers.paydunya.com/doc/FR/http_json, section IPN, relue le 20/08 —
 * texte exact : "Le hash renvoyé par PayDunya est le hash de votre
 * MasterKey (clé principale)... L'algorithme utilisé pour obtenir le hash
 * est du SHA-512."). Le calcul SHA-512(masterKey) était déjà correct.
 *
 * MAIS ce hash ne dépend jamais du payload (ni montant, ni statut, ni
 * token) : c'est une valeur CONSTANTE tant que la master key n'est pas
 * rotée. Quiconque l'a vue une seule fois (un attaquant peut simplement
 * faire un vrai petit achat chez nous) peut la rejouer indéfiniment avec
 * n'importe quel payload forgé. Ce n'est donc PAS une preuve d'intégrité —
 * juste un filtre qui élimine le bruit non authentifié. La vraie source de
 * vérité est confirmPayDunyaInvoice() ci-dessous.
 */
function verifyPayDunyaHash(signatureHeader) {
  const masterKey = process.env.PAYDUNYA_MASTER_KEY;
  if (!masterKey) {
    console.warn("[PayDunya Webhook] PAYDUNYA_MASTER_KEY non configurée.");
    return process.env.NODE_ENV !== "production";
  }
  if (!signatureHeader) return false;

  const calculatedHash = crypto.createHash("sha512").update(masterKey).digest("hex");
  const received = Buffer.from(signatureHeader);
  const expected = Buffer.from(calculatedHash);
  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(received, expected);
}

/**
 * Seule source de vérité retenue pour agir sur un paiement : une requête
 * GET authentifiée avec NOS PROPRES clés (jamais rien tiré du webhook
 * reçu) vers l'API de confirmation officielle PayDunya
 * (developers.paydunya.com/doc/FR/http_json, section "ETAT DE PAIEMENT").
 * Le statut/montant annoncés dans le corps du POST reçu ne sont jamais
 * utilisés directement — seule cette réponse, authentifiée par nos
 * identifiants secrets sur le domaine PayDunya, fait foi.
 */
async function confirmPayDunyaInvoice(invoiceToken) {
  const masterKey = process.env.PAYDUNYA_MASTER_KEY;
  const privateKey = process.env.PAYDUNYA_PRIVATE_KEY;
  const apiToken = process.env.PAYDUNYA_TOKEN;
  if (!masterKey || !privateKey || !apiToken) {
    throw new Error("Clés PayDunya manquantes (PAYDUNYA_MASTER_KEY/PAYDUNYA_PRIVATE_KEY/PAYDUNYA_TOKEN).");
  }

  const base =
    process.env.NODE_ENV === "production"
      ? "https://app.paydunya.com/api/v1"
      : "https://app.paydunya.com/sandbox-api/v1";

  const res = await fetch(`${base}/checkout-invoice/confirm/${encodeURIComponent(invoiceToken)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "PAYDUNYA-MASTER-KEY": masterKey,
      "PAYDUNYA-PRIVATE-KEY": privateKey,
      "PAYDUNYA-TOKEN": apiToken,
    },
  });

  if (!res.ok) {
    throw new Error(`Confirmation PayDunya HTTP ${res.status}`);
  }

  const data = await res.json();
  if (data.response_code !== "00") {
    throw new Error(`Confirmation PayDunya refusée: ${data.response_text || "réponse inattendue"}`);
  }
  return data;
}

/**
 * PayDunya documente un envoi en application/x-www-form-urlencoded avec un
 * nœud racine "data" (tableau PHP), mais aucun webhook réel n'a jamais été
 * reçu en production pour confirmer le format effectif (table
 * processed_webhooks vide, provider='paydunya'). Parsing volontairement
 * défensif — JSON puis form-urlencoded, avec ou sans enveloppe "data" — car
 * la seule donnée réellement nécessaire du corps est le jeton d'invoice :
 * tout le reste (statut, montant) est re-vérifié via confirmPayDunyaInvoice.
 */
function extractInvoiceToken(payload) {
  const data = payload.data || payload;
  return data.token || data.invoice_token || data.invoice?.token || null;
}

export async function POST(req) {
  try {
    const rawBody = await req.text();
    let payload = {};

    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = Object.fromEntries(new URLSearchParams(rawBody));
    }

    const signature = req.headers.get("x-paydunya-signature") || payload.hash || payload.data?.hash || "";

    // 1. Filtre bon marché (voir commentaire ci-dessus) — rejette tout de
    // suite un appel qui ne connaît même pas le hash constant.
    const isValid = verifyPayDunyaHash(signature);
    if (!isValid && process.env.NODE_ENV === "production") {
      console.warn("[PayDunya Webhook] Hash invalide rejeté.");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 2. Le webhook n'est traité que comme un déclencheur, jamais comme une
    // source de vérité (voir confirmPayDunyaInvoice). On ignore
    // volontairement son statut/montant annoncés.
    const invoiceToken = extractInvoiceToken(payload);
    if (!invoiceToken) {
      console.warn("[PayDunya Webhook] Aucun invoice token trouvé dans le payload reçu.");
      return NextResponse.json({ error: "Missing invoice token" }, { status: 400 });
    }

    let confirmed;
    try {
      confirmed = await confirmPayDunyaInvoice(invoiceToken);
    } catch (err) {
      console.error("[PayDunya Webhook] Échec de la confirmation serveur-à-serveur:", err.message);
      return NextResponse.json({ error: "Confirmation failed" }, { status: 502 });
    }

    const confirmedStatus = confirmed.status;
    const eventId = confirmed.invoice?.token || invoiceToken;
    const eventType = confirmedStatus === "completed" ? "payment.success" : "payment.updated";

    // 3. Envoi asynchrone dans la file RabbitMQ — payload = données
    // CONFIRMÉES par PayDunya (jamais le corps du POST reçu).
    await enqueueWebhookJob({
      provider: "paydunya",
      eventType,
      payload: {
        ...confirmed,
        eventId,
        status: confirmedStatus,
      },
      signature,
    });

    // 4. Réponse 200 immédiate à la passerelle de paiement
    return NextResponse.json({ received: true, eventId });
  } catch (err) {
    console.error("[PayDunya Webhook Route] Erreur réception webhook:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
