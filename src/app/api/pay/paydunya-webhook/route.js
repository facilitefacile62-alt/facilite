import { NextResponse } from "next/server";
import crypto from "crypto";
import { enqueueWebhookJob } from "@/lib/queueProducers";

/**
 * Vérifie la signature PayDunya (Hash SHA-512 du MasterKey ou token).
 */
function verifyPayDunyaSignature(payload, signatureHeader) {
  const masterKey = process.env.PAYDUNYA_MASTER_KEY;
  if (!masterKey) {
    // Si la clé n'est pas encore configurée en dev, on logue un avertissement
    console.warn("[PayDunya Webhook] PAYDUNYA_MASTER_KEY non configurée.");
    return process.env.NODE_ENV !== "production";
  }

  if (!signatureHeader) return false;

  // Calcul du hash SHA-512 du MasterKey pour validation
  const calculatedHash = crypto.createHash("sha512").update(masterKey).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(calculatedHash), Buffer.from(signatureHeader));
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

    const signature = req.headers.get("x-paydunya-signature") || payload.hash || "";

    // 1. Validation cryptographique
    const isValid = verifyPayDunyaSignature(payload, signature);
    if (!isValid && process.env.NODE_ENV === "production") {
      console.warn("[PayDunya Webhook] Signature invalide rejetée.");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 2. Détermination de l'identifiant unique d'événement (pour idempotence)
    const eventId = payload.token || payload.invoice_token || payload.id || crypto.randomUUID();
    const eventType = payload.status === "completed" ? "payment.success" : "payment.updated";

    // 3. Envoi asynchrone ultra-rapide dans la file RabbitMQ
    await enqueueWebhookJob({
      provider: "paydunya",
      eventType,
      payload: {
        ...payload,
        eventId,
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
