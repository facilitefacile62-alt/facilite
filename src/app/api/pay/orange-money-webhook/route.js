import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { verifierSignatureWebhook } from "@/lib/orangeMoney";
import { captureCriticalPaymentError } from "@/lib/sentryAlert";

export const runtime = "nodejs";

// Confirmation de paiement Orange Money "Paiement Marchand" (QR code) —
// événement asynchrone, jamais une réponse directe à l'appel d'initiation
// (voir orange-money-checkout/route.js). Un 4xx n'est jamais retenté par
// Orange, un timeout/5xx l'est en boucle : toute anomalie récupérable doit
// donc répondre 5xx, jamais 4xx, pour laisser Orange réessayer.
export async function POST(req) {
  const secret = process.env.ORANGE_MONEY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[Webhook Orange Money] ORANGE_MONEY_WEBHOOK_SECRET manquant côté serveur.");
    return NextResponse.json({ error: "Webhook non configuré." }, { status: 503 });
  }

  // Corps BRUT lu avant tout parsing JSON — la signature HMAC est calculée
  // sur les octets exacts reçus, un corps re-sérialisé après JSON.parse ne
  // produirait pas le même résultat (voir verifierSignatureWebhook).
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-sonatel-signature");
  const idempotencyKey = req.headers.get("x-sonatel-idempotency-key");

  const verification = verifierSignatureWebhook(rawBody, signatureHeader, secret);
  if (!verification.valide) {
    console.error("[Webhook Orange Money] Signature invalide —", verification.motif);
    captureCriticalPaymentError("[Webhook Orange Money] Signature invalide", { motif: verification.motif });
    return NextResponse.json({ error: "Signature invalide." }, { status: 401 });
  }

  if (!idempotencyKey) {
    console.error("[Webhook Orange Money] En-tête X-Sonatel-Idempotency-Key absent.");
    captureCriticalPaymentError("[Webhook Orange Money] Idempotency-Key absente");
    return NextResponse.json({ error: "En-tête d'idempotence requis." }, { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (err) {
    console.error("[Webhook Orange Money]", err.message);
    captureCriticalPaymentError("[Webhook Orange Money] Service role manquant", { message: err.message });
    return NextResponse.json({ error: "Webhook non configuré (service role manquant)." }, { status: 503 });
  }

  // reference porte notre transactions.id (UUID) — voir
  // orange-money-checkout/route.js qui l'envoie tel quel en tant que
  // `reference` à l'appel de génération du QR code.
  const reference = event.reference;
  const orangeTransactionId = event.transactionId;
  const status = event.status;

  // Déduplication : un INSERT qui échoue sur la contrainte UNIQUE
  // (idempotency_key) signifie "déjà traité" — l'événement est journalisé
  // une seule fois, avant tout traitement métier, exactement comme
  // logKpayWebhook journalise avant traitement (mais ici la journalisation
  // EST le mécanisme d'idempotence, pas un simple best-effort séparé).
  const { error: insertLogError } = await supabaseAdmin.from("orange_money_webhook_events").insert({
    idempotency_key: idempotencyKey,
    status: status || null,
    orange_transaction_id: orangeTransactionId || null,
    reference: reference || null,
    raw_payload: event,
  });

  if (insertLogError) {
    if (insertLogError.code === "23505") {
      // Conflit sur idempotency_key : déjà traité, accusé de réception sans
      // retraiter la transaction (le traitement métier ci-dessous n'est de
      // toute façon plus atteint une seconde fois grâce à la transition
      // atomique pending -> success/failed, mais on économise l'appel).
      return NextResponse.json({ received: true, alreadyProcessed: true });
    }
    console.error("[Webhook Orange Money] Échec journalisation :", insertLogError.message);
    captureCriticalPaymentError("[Webhook Orange Money] Échec journalisation", { message: insertLogError.message });
    // Récupérable (panne DB passagère) : 5xx pour qu'Orange retente, plutôt
    // que de traiter le paiement sans aucune trace d'audit.
    return NextResponse.json({ error: "Erreur interne du webhook." }, { status: 500 });
  }

  if (!reference) {
    console.error("[Webhook Orange Money] Événement sans reference.", event);
    captureCriticalPaymentError("[Webhook Orange Money] Événement sans reference", { orangeTransactionId, status });
    return NextResponse.json({ received: true, warning: "missing_reference" });
  }

  try {
    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("id", reference)
      .eq("provider", "orange_money")
      .single();

    if (transactionError || !transaction) {
      console.error("[Webhook Orange Money] Transaction introuvable pour reference", reference);
      captureCriticalPaymentError("[Webhook Orange Money] Transaction introuvable", { reference, orangeTransactionId });
      return NextResponse.json({ received: true, warning: "not_found" });
    }

    if (status !== "SUCCESS") {
      // Tout statut non-SUCCESS (FAILED, EXPIRED...) est traité comme un
      // échec final — reflète l'état réel de la transaction plutôt que de
      // la laisser bloquée en "pending" indéfiniment (même raisonnement que
      // handleCvOrderFailure côté KPay).
      await supabaseAdmin
        .from("transactions")
        .update({ status: "failed" })
        .eq("id", transaction.id)
        .eq("status", "pending");

      await supabaseAdmin
        .from("orange_money_webhook_events")
        .update({ transaction_id: transaction.id })
        .eq("idempotency_key", idempotencyKey);

      return NextResponse.json({ received: true });
    }

    const { data: updatedTransactions, error: updateError } = await supabaseAdmin
      .from("transactions")
      .update({
        status: "success",
        provider_reference: orangeTransactionId || transaction.provider_reference,
      })
      .eq("id", transaction.id)
      .eq("status", "pending")
      .select();

    if (updateError) {
      console.error("[Webhook Orange Money] Échec mise à jour de la transaction :", updateError.message);
      captureCriticalPaymentError("[Webhook Orange Money] Échec mise à jour de la transaction", { message: updateError.message, transactionId: transaction.id });
      return NextResponse.json({ error: "Erreur interne du webhook." }, { status: 500 });
    }

    await supabaseAdmin
      .from("orange_money_webhook_events")
      .update({ transaction_id: transaction.id })
      .eq("idempotency_key", idempotencyKey);

    if (!updatedTransactions || updatedTransactions.length === 0) {
      // Déjà passée à "success" par un événement précédent (idempotence de
      // la transition elle-même, en plus de la déduplication ci-dessus).
      return NextResponse.json({ received: true, alreadyProcessed: true });
    }

    const updatedTransaction = updatedTransactions[0];
    const planName = updatedTransaction.metadata?.plan_name || "premium";

    const { data: subscription, error: subSelectError } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("user_id", updatedTransaction.user_id)
      .single();

    if (!subscription && subSelectError?.code === "PGRST116") {
      await supabaseAdmin.from("subscriptions").insert({
        user_id: updatedTransaction.user_id,
        plan_name: planName,
        status: "active",
      });
    } else if (subscription) {
      await supabaseAdmin
        .from("subscriptions")
        .update({ plan_name: planName, status: "active" })
        .eq("id", subscription.id);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Webhook Orange Money] Erreur interne :", error);
    captureCriticalPaymentError("[Webhook Orange Money] Erreur interne", { message: error?.message, reference, orangeTransactionId });
    return NextResponse.json({ error: "Erreur interne du webhook." }, { status: 500 });
  }
}
