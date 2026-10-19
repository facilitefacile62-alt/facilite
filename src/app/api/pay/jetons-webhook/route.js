import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { verifierSignatureWebhook, jetonCallbackValide, hasherJetonCallback, obtenirStatutTransaction, evaluerConfirmationOrange } from "@/lib/orangeMoney";
import { captureCriticalPaymentError } from "@/lib/sentryAlert";

export const runtime = "nodejs";

// Événement déjà traité : 202 au corps vide, la réponse recommandée par Orange
// (tout 2xx marque l'événement livré, un 4xx serait un rejet définitif).
const deja_traite = () => new NextResponse(null, { status: 202 });

// Le journal des événements sert de mécanisme d'idempotence (clé UNIQUE) : il
// est écrit AVANT le traitement. Si le traitement échoue en 5xx, Orange relance
// avec la même clé ; il faut donc retirer l'événement du journal, sinon la
// relance serait prise pour un doublon et ignorée. Meilleur effort : une
// erreur ici est journalisée, jamais propagée.
async function retirerJournal(supabaseAdmin, idempotencyKey) {
  try {
    await supabaseAdmin.from("jetons_webhook_events").delete().eq("idempotency_key", idempotencyKey);
  } catch (err) {
    console.error("[Webhook Jetons] Impossible de retirer l'événement du journal :", err?.message);
  }
}

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
  // Corps BRUT lu avant tout parsing JSON — la signature HMAC est calculée
  // sur les octets exacts reçus (voir verifierSignatureWebhook).
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-sonatel-signature");
  const secret = process.env.ORANGE_MONEY_WEBHOOK_SECRET;

  // Orange ne signe pas encore ses notifications (« évolution à venir ») : la signature est vérifiée QUAND l'en-tête est
  // présent et qu'un secret est configuré — une signature fausse est refusée net. Sans signature, la notification n'est
  // qu'un déclencheur : voir la confirmation auprès d'Orange plus bas, qui s'applique dans tous les cas.
  let signee = false;
  if (signatureHeader && secret) {
    const verification = verifierSignatureWebhook(rawBody, signatureHeader, secret);
    if (!verification.valide) {
      console.error("[Webhook Jetons] Signature invalide —", verification.motif);
      captureCriticalPaymentError("[Webhook Jetons] Signature invalide", { motif: verification.motif });
      return NextResponse.json({ error: "Signature invalide." }, { status: 401 });
    }
    signee = true;
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

  if (!reference || typeof reference !== "string") {
    console.error("[Webhook Jetons] Événement sans reference.");
    captureCriticalPaymentError("[Webhook Jetons] Événement sans reference", { orangeTransactionId, status });
    return NextResponse.json({ received: true, warning: "missing_reference" });
  }

  const { data: transaction, error: transactionError } = await supabaseAdmin
    .from("jetons_transactions")
    .select("*")
    .eq("id", reference)
    .eq("type", "achat")
    .maybeSingle();

  // Première barrière : un jeton propre à la commande dans l'URL de callback (ou une signature valide). Réponse 404 sans
  // aucun détail, et jamais d'appel à Orange : sinon n'importe qui pourrait nous faire interroger Orange à volonté.
  const jetonUrl = new URL(req.url).searchParams.get("t");
  if (transactionError || !transaction || !(signee || jetonCallbackValide(jetonUrl, transaction.callback_token_hash))) {
    console.error("[Webhook Jetons] Notification refusée (commande inconnue ou jeton de callback invalide).");
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  // Clé d'idempotence : celle d'Orange, sinon dérivée de l'événement (Orange ne l'envoie peut-être pas sans signature).
  const idempotencyKey =
    req.headers.get("x-sonatel-idempotency-key") ||
    `derivee:${hasherJetonCallback(`${reference}|${orangeTransactionId || ""}|${status || ""}`)}`;

  // Déduplication : un INSERT qui échoue sur la contrainte UNIQUE
  // (idempotency_key) signifie "déjà traité" — journalisé avant tout
  // traitement métier, la journalisation EST le mécanisme d'idempotence.
  const { error: insertLogError } = await supabaseAdmin.from("jetons_webhook_events").insert({
    idempotency_key: idempotencyKey,
    status: status || null,
    orange_transaction_id: orangeTransactionId || null,
    reference,
    raw_payload: event,
  });

  if (insertLogError) {
    if (insertLogError.code === "23505") {
      return deja_traite();
    }
    console.error("[Webhook Jetons] Échec journalisation :", insertLogError.message);
    captureCriticalPaymentError("[Webhook Jetons] Échec journalisation", { message: insertLogError.message });
    return NextResponse.json({ error: "Erreur interne du webhook." }, { status: 500 });
  }

  // La notification n'est qu'un déclencheur : l'état RÉEL du paiement est confirmé auprès d'Orange (jeton OAuth), jamais
  // lu dans le corps reçu. Aucun crédit sans cette confirmation, même quand la signature est valide.
  if (!orangeTransactionId) {
    captureCriticalPaymentError("[Webhook Jetons] Notification sans transactionId, confirmation impossible", { reference });
    await retirerJournal(supabaseAdmin, idempotencyKey);
    return new NextResponse(null, { status: 202 });
  }
  let confirmation;
  try {
    const reponseOrange = await obtenirStatutTransaction(orangeTransactionId);
    confirmation = evaluerConfirmationOrange(reponseOrange, { reference: transaction.id, montantXof: transaction.montant_xof });
  } catch (err) {
    // Orange injoignable : 5xx pour qu'il relance, journal retiré pour que la relance ne soit pas prise pour un doublon.
    console.error("[Webhook Jetons] Confirmation auprès d'Orange impossible :", err.message);
    await retirerJournal(supabaseAdmin, idempotencyKey);
    return NextResponse.json({ error: "Confirmation indisponible." }, { status: 502 });
  }
  if (confirmation.etat === "incoherent") {
    // Paiement « réussi » mais qui ne correspond pas à la commande (ou commande sans montant figé) : jamais de crédit.
    console.error("[Webhook Jetons] Confirmation incohérente —", confirmation.raison);
    captureCriticalPaymentError("[Webhook Jetons] Confirmation incohérente avec la commande", { reference, motif: confirmation.raison });
    return NextResponse.json({ received: true, warning: "mismatch" });
  }
  if (confirmation.etat === "attente") {
    // Statut intermédiaire : rien ne change, Orange renverra une notification au statut final.
    await retirerJournal(supabaseAdmin, idempotencyKey);
    return new NextResponse(null, { status: 202 });
  }

  try {
    if (confirmation.etat === "echec") {
      // Échec final confirmé par Orange (FAILED, EXPIRED…) : reflète l'état réel plutôt que de laisser la
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
      await retirerJournal(supabaseAdmin, idempotencyKey);
      return NextResponse.json({ error: "Erreur interne du webhook." }, { status: 500 });
    }

    await supabaseAdmin
      .from("jetons_webhook_events")
      .update({ jetons_transaction_id: transaction.id })
      .eq("idempotency_key", idempotencyKey);

    if (!updatedTransactions || updatedTransactions.length === 0) {
      // Déjà passée à "success" par un événement précédent (idempotence de
      // la transition elle-même, en plus de la déduplication ci-dessus).
      return deja_traite();
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
      // Le crédit a échoué alors que la transaction vient de passer à
      // "success" : on la remet à "pending" et on retire l'événement du
      // journal pour que la relance d'Orange (5xx, même clé d'idempotence)
      // refasse tout. Sans cela la relance trouvait l'événement « déjà
      // traité » et l'achat restait payé mais jamais crédité. L'alerte
      // critique reste remontée pour suivi.
      await supabaseAdmin.from("jetons_transactions").update({ status: "pending" }).eq("id", transaction.id).eq("status", "success");
      await retirerJournal(supabaseAdmin, idempotencyKey);
      return NextResponse.json({ error: "Erreur interne du webhook." }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Webhook Jetons] Erreur interne :", error);
    captureCriticalPaymentError("[Webhook Jetons] Erreur interne", { message: error?.message, reference, orangeTransactionId });
    await retirerJournal(supabaseAdmin, idempotencyKey);
    return NextResponse.json({ error: "Erreur interne du webhook." }, { status: 500 });
  }
}
