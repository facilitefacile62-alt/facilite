import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { verifierSignatureWebhook } from "@/lib/orangeMoney";
import { captureCriticalPaymentError } from "@/lib/sentryAlert";

export const runtime = "nodejs";

// Confirmation de paiement de la formation "Rédaction de CV" via Orange
// Money "Paiement Marchand" (QR code) — événement asynchrone, jamais une
// réponse directe à l'appel d'initiation (voir formation-cv-checkout/route.js).
// Même structure que jetons-webhook/route.js (le seul flux Orange Money
// vivant, voir 20260925150000) : seule la table créditée change
// (formation_redaction_cv_inscriptions.paye au lieu de jetons_boutique). Un
// 4xx n'est jamais retenté par Orange, un timeout/5xx l'est en boucle :
// toute anomalie récupérable doit donc répondre 5xx, jamais 4xx.
export async function POST(req) {
  const secret = process.env.ORANGE_MONEY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[Webhook Formation CV] ORANGE_MONEY_WEBHOOK_SECRET manquant côté serveur.");
    return NextResponse.json({ error: "Webhook non configuré." }, { status: 503 });
  }

  // Corps BRUT lu avant tout parsing JSON — la signature HMAC est calculée
  // sur les octets exacts reçus (voir verifierSignatureWebhook).
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-sonatel-signature");
  const idempotencyKey = req.headers.get("x-sonatel-idempotency-key");

  const verification = verifierSignatureWebhook(rawBody, signatureHeader, secret);
  if (!verification.valide) {
    console.error("[Webhook Formation CV] Signature invalide —", verification.motif);
    captureCriticalPaymentError("[Webhook Formation CV] Signature invalide", { motif: verification.motif });
    return NextResponse.json({ error: "Signature invalide." }, { status: 401 });
  }

  if (!idempotencyKey) {
    console.error("[Webhook Formation CV] En-tête X-Sonatel-Idempotency-Key absent.");
    captureCriticalPaymentError("[Webhook Formation CV] Idempotency-Key absente");
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
    console.error("[Webhook Formation CV]", err.message);
    captureCriticalPaymentError("[Webhook Formation CV] Service role manquant", { message: err.message });
    return NextResponse.json({ error: "Webhook non configuré (service role manquant)." }, { status: 503 });
  }

  // reference porte notre formation_redaction_cv_inscriptions.id (UUID) —
  // voir formation-cv-checkout/route.js qui l'envoie tel quel en tant que
  // `reference` à l'appel de génération du QR code.
  const reference = event.reference;
  const orangeTransactionId = event.transactionId;
  const status = event.status;

  // Déduplication : un INSERT qui échoue sur la contrainte UNIQUE
  // (idempotency_key) signifie "déjà traité" — journalisé avant tout
  // traitement métier, la journalisation EST le mécanisme d'idempotence.
  const { error: insertLogError } = await supabaseAdmin.from("formation_redaction_cv_webhook_events").insert({
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
    console.error("[Webhook Formation CV] Échec journalisation :", insertLogError.message);
    captureCriticalPaymentError("[Webhook Formation CV] Échec journalisation", { message: insertLogError.message });
    return NextResponse.json({ error: "Erreur interne du webhook." }, { status: 500 });
  }

  if (!reference) {
    console.error("[Webhook Formation CV] Événement sans reference.", event);
    captureCriticalPaymentError("[Webhook Formation CV] Événement sans reference", { orangeTransactionId, status });
    return NextResponse.json({ received: true, warning: "missing_reference" });
  }

  try {
    // user_id sélectionné pour la traçabilité des erreurs ci-dessous
    // (reference == inscription.id suffit à la mise à jour elle-même,
    // user_id étant UNIQUE sur cette table : une ligne == un utilisateur).
    const { data: inscription, error: inscriptionError } = await supabaseAdmin
      .from("formation_redaction_cv_inscriptions")
      .select("id, user_id, paye")
      .eq("id", reference)
      .single();

    if (inscriptionError || !inscription) {
      console.error("[Webhook Formation CV] Inscription introuvable pour reference", reference);
      captureCriticalPaymentError("[Webhook Formation CV] Inscription introuvable", { reference, orangeTransactionId });
      return NextResponse.json({ received: true, warning: "not_found" });
    }

    await supabaseAdmin
      .from("formation_redaction_cv_webhook_events")
      .update({ inscription_id: inscription.id })
      .eq("idempotency_key", idempotencyKey);

    if (status !== "SUCCESS") {
      // Tout statut non-SUCCESS (FAILED, EXPIRED...) : rien à créditer, on
      // laisse simplement paye=false — l'utilisateur peut regénérer un QR
      // depuis la page (même ligne d'inscription réutilisée).
      return NextResponse.json({ received: true });
    }

    if (inscription.paye) {
      // Déjà traité par un événement précédent (idempotence de la
      // transition elle-même, en plus de la déduplication ci-dessus).
      return NextResponse.json({ received: true, alreadyProcessed: true });
    }

    const { error: updateError } = await supabaseAdmin
      .from("formation_redaction_cv_inscriptions")
      .update({ paye: true, paye_le: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", inscription.id)
      .eq("paye", false);

    if (updateError) {
      console.error("[Webhook Formation CV] Échec mise à jour de l'inscription :", updateError.message);
      captureCriticalPaymentError("[Webhook Formation CV] Échec mise à jour de l'inscription", { message: updateError.message, inscriptionId: inscription.id, userId: inscription.user_id });
      return NextResponse.json({ error: "Erreur interne du webhook." }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Webhook Formation CV] Erreur interne :", error);
    captureCriticalPaymentError("[Webhook Formation CV] Erreur interne", { message: error?.message, reference, orangeTransactionId });
    return NextResponse.json({ error: "Erreur interne du webhook." }, { status: 500 });
  }
}
