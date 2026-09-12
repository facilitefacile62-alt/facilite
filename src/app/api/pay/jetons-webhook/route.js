import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { verifierSignatureWebhook } from "@/lib/orangeMoney";
import { captureCriticalPaymentError } from "@/lib/sentryAlert";

export const runtime = "nodejs";

// Confirmation d'achat de jetons Marketplace via Orange Money "Paiement
// Marchand" (QR code) — événement asynchrone, jamais une réponse directe à
// l'appel d'initiation (voir jetons-checkout/route.js). Structure identique
// à l'ancien orange-money-webhook (transactions/subscriptions, abandonné) :
// seule la table créditée change (jetons_boutique via
// crediter_jetons_boutique, SECURITY DEFINER — jamais un UPDATE direct,
// pour respecter la contrainte solde_jetons >= 0 atomiquement). Un 4xx
// n'est jamais retenté par Orange, un timeout/5xx l'est en boucle : toute
// anomalie récupérable doit donc répondre 5xx, jamais 4xx.
export async function POST(req) {
  const secret = process.env.ORANGE_MONEY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[Webhook Jetons] ORANGE_MONEY_WEBHOOK_SECRET manquant côté serveur.");
    return NextResponse.json({ error: "Webhook non configuré." }, { status: 503 });
  }

  // Corps BRUT lu avant tout parsing JSON — la signature HMAC est calculée
  // sur les octets exacts reçus (voir verifierSignatureWebhook).
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-sonatel-signature");
  const idempotencyKey = req.headers.get("x-sonatel-idempotency-key");

  const verification = verifierSignatureWebhook(rawBody, signatureHeader, secret);
  if (!verification.valide) {
    console.error("[Webhook Jetons] Signature invalide —", verification.motif);
    captureCriticalPaymentError("[Webhook Jetons] Signature invalide", { motif: verification.motif });
    return NextResponse.json({ error: "Signature invalide." }, { status: 401 });
  }

  if (!idempotencyKey) {
    console.error("[Webhook Jetons] En-tête X-Sonatel-Idempotency-Key absent.");
    captureCriticalPaymentError("[Webhook Jetons] Idempotency-Key absente");
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
    console.error("[Webhook Jetons]", err.message);
    captureCriticalPaymentError("[Webhook Jetons] Service role manquant", { message: err.message });
    return NextResponse.json({ error: "Webhook non configuré (service role manquant)." }, { status: 503 });
  }

  // reference porte notre jetons_transactions.id (UUID) — voir
  // jetons-checkout/route.js qui l'envoie tel quel en tant que `reference`
  // à l'appel de génération du QR code.
  const reference = event.reference;
  const orangeTransactionId = event.transactionId;
  const status = event.status;

  // Déduplication : un INSERT qui échoue sur la contrainte UNIQUE
  // (idempotency_key) signifie "déjà traité" — journalisé avant tout
  // traitement métier, la journalisation EST le mécanisme d'idempotence.
  const { error: insertLogError } = await supabaseAdmin.from("jetons_webhook_events").insert({
    idempotency_key: idempotencyKey,
    status: status || null,
    orange_transaction_id: orangeTransactionId || null,
    reference: reference || null,
    raw_payload: event,
  });

  if (insertLogError) {
    if (insertLogError.code === "23505") {
      return NextResponse.json({ received: true, alreadyProcessed: true });
    }
    console.error("[Webhook Jetons] Échec journalisation :", insertLogError.message);
    captureCriticalPaymentError("[Webhook Jetons] Échec journalisation", { message: insertLogError.message });
    return NextResponse.json({ error: "Erreur interne du webhook." }, { status: 500 });
  }

  if (!reference) {
    console.error("[Webhook Jetons] Événement sans reference.", event);
    captureCriticalPaymentError("[Webhook Jetons] Événement sans reference", { orangeTransactionId, status });
    return NextResponse.json({ received: true, warning: "missing_reference" });
  }

  try {
    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from("jetons_transactions")
      .select("*")
      .eq("id", reference)
      .eq("type", "achat")
      .single();

    if (transactionError || !transaction) {
      console.error("[Webhook Jetons] Transaction introuvable pour reference", reference);
      captureCriticalPaymentError("[Webhook Jetons] Transaction introuvable", { reference, orangeTransactionId });
      return NextResponse.json({ received: true, warning: "not_found" });
    }

    if (status !== "SUCCESS") {
      // Tout statut non-SUCCESS (FAILED, EXPIRED...) est traité comme un
      // échec final — reflète l'état réel plutôt que de laisser la
      // transaction bloquée en "pending" indéfiniment.
      await supabaseAdmin
        .from("jetons_transactions")
        .update({ status: "failed" })
        .eq("id", transaction.id)
        .eq("status", "pending");

      await supabaseAdmin
        .from("jetons_webhook_events")
        .update({ jetons_transaction_id: transaction.id })
        .eq("idempotency_key", idempotencyKey);

      return NextResponse.json({ received: true });
    }

    const { data: updatedTransactions, error: updateError } = await supabaseAdmin
      .from("jetons_transactions")
      .update({
        status: "success",
        provider_reference: orangeTransactionId || transaction.provider_reference,
      })
      .eq("id", transaction.id)
      .eq("status", "pending")
      .select();

    if (updateError) {
      console.error("[Webhook Jetons] Échec mise à jour de la transaction :", updateError.message);
      captureCriticalPaymentError("[Webhook Jetons] Échec mise à jour de la transaction", { message: updateError.message, transactionId: transaction.id });
      return NextResponse.json({ error: "Erreur interne du webhook." }, { status: 500 });
    }

    await supabaseAdmin
      .from("jetons_webhook_events")
      .update({ jetons_transaction_id: transaction.id })
      .eq("idempotency_key", idempotencyKey);

    if (!updatedTransactions || updatedTransactions.length === 0) {
      // Déjà passée à "success" par un événement précédent (idempotence de
      // la transition elle-même, en plus de la déduplication ci-dessus).
      return NextResponse.json({ received: true, alreadyProcessed: true });
    }

    const updatedTransaction = updatedTransactions[0];

    // Crédit du solde via fonction SECURITY DEFINER dédiée (jamais un
    // UPDATE direct depuis le webhook) : upsert atomique store_id ->
    // solde_jetons, respecte la contrainte solde_jetons >= 0 sans course
    // possible entre deux webhooks concurrents pour la même boutique.
    const { error: creditError } = await supabaseAdmin.rpc("crediter_jetons_boutique", {
      p_store_id: updatedTransaction.store_id,
      p_montant: updatedTransaction.montant,
    });

    if (creditError) {
      console.error("[Webhook Jetons] Échec crédit du solde :", creditError.message);
      captureCriticalPaymentError("[Webhook Jetons] Échec crédit du solde", { message: creditError.message, storeId: updatedTransaction.store_id, transactionId: transaction.id });
      // La transaction est déjà "success" (traçable), mais le crédit a
      // échoué : erreur critique remontée pour intervention manuelle
      // plutôt qu'un jeton d'achat payé mais jamais crédité en silence.
      return NextResponse.json({ error: "Erreur interne du webhook." }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Webhook Jetons] Erreur interne :", error);
    captureCriticalPaymentError("[Webhook Jetons] Erreur interne", { message: error?.message, reference, orangeTransactionId });
    return NextResponse.json({ error: "Erreur interne du webhook." }, { status: 500 });
  }
}
