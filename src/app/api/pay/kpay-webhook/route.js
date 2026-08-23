import crypto from "crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { generateAndStoreInvoice } from "@/lib/invoiceGenerator";
import { sendInvoiceEmail, sendWhatsAppConfirmation } from "@/lib/notifications";
import { isEquivalentCfaCurrency, isPlaceholderKpaySecret } from "@/lib/kpay";
import { labelForCvModel } from "@/lib/cvModels";
import { captureCriticalPaymentError } from "@/lib/sentryAlert";

export const runtime = "nodejs";

/**
 * Vérifie que la requête provient bien de KPay : le corps brut (non parsé)
 * doit produire, une fois signé en HMAC SHA256 avec le secret webhook,
 * exactement la valeur du header X-KPAY-Signature (voir
 * https://kpay.site/documentation/webhooks). Sans cette vérification,
 * n'importe qui connaissant l'URL du webhook pourrait simuler un paiement
 * réussi.
 */
function isValidKpaySignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;

  const expectedHash = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  const expectedBuf = Buffer.from(expectedHash, "utf8");
  const receivedBuf = Buffer.from(signatureHeader, "utf8");
  if (expectedBuf.length !== receivedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

// --- Flux 1 : confection de CV (table "orders") ---
// Restauré à l'identique de la version pré-refactor (commit c9a75f7) :
// facture PDF + email + confirmation WhatsApp, idempotence via la
// transition atomique payment_status pending -> paid.
async function handleCvOrderPayment(supabaseAdmin, event, orderId, kpayPaymentId) {
  const orderQuery = supabaseAdmin.from("orders").select("*");
  const { data: order, error: orderError } = orderId
    ? await orderQuery.eq("id", orderId).single()
    : await orderQuery.eq("payment_reference", kpayPaymentId).single();

  if (orderError || !order) return { handled: false };

  if (typeof event.amount === "number" && event.amount !== Number(order.amount)) {
    console.error(`[Webhook KPay] Montant incohérent pour la commande ${order.id} : reçu ${event.amount}, attendu ${order.amount}.`);
    return { handled: true, response: NextResponse.json({ received: true, warning: "amount_mismatch" }) };
  }

  if (event.currency && !isEquivalentCfaCurrency(event.currency, order.currency)) {
    console.error(`[Webhook KPay] Devise incohérente pour la commande ${order.id} : reçu ${event.currency}, attendu ${order.currency}.`);
    return { handled: true, response: NextResponse.json({ received: true, warning: "currency_mismatch" }) };
  }

  const { data: updatedOrders, error: updateError } = await supabaseAdmin
    .from("orders")
    .update({
      payment_status: "paid",
      payment_method: "kpay",
      payment_reference: kpayPaymentId || order.payment_reference,
    })
    .eq("id", order.id)
    .eq("payment_status", "pending")
    .select();

  if (updateError) {
    console.error("[Webhook KPay] Échec mise à jour de la commande :", updateError.message);
    return { handled: true, response: NextResponse.json({ error: "Échec de la mise à jour de la commande." }, { status: 500 }) };
  }

  if (!updatedOrders || updatedOrders.length === 0) {
    return { handled: true, response: NextResponse.json({ received: true, alreadyProcessed: true }) };
  }

  const updatedOrder = updatedOrders[0];

  if (updatedOrder.has_agent_option) {
    const { error: assignmentError } = await supabaseAdmin.from("agent_assignments").insert({
      order_id: updatedOrder.id,
      candidate_id: updatedOrder.user_id,
      status: "unassigned",
    });
    if (assignmentError) {
      console.error("[Webhook KPay] Échec création agent_assignments :", assignmentError.message);
    }
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, email, phone, contact_email")
    .eq("id", updatedOrder.user_id)
    .single();

  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(updatedOrder.user_id);

  const customer = {
    fullName: profile?.full_name || authUser?.user?.email || "Client Facilite",
    email: profile?.contact_email || profile?.email || authUser?.user?.email || null,
    phone: profile?.phone || authUser?.user?.phone || event.phoneNumber || null,
  };

  let invoiceNumber = null;
  let invoiceSignedUrl = null;
  let pdfBuffer = null;
  try {
    const lineItems = [
      { description: `Confection de CV — ${labelForCvModel(updatedOrder.cv_model_id)}`, amount: 1500 },
    ];
    if (updatedOrder.has_agent_option) {
      lineItems.push({ description: "Option accompagnement personnalisé par un expert", amount: 500 });
    }

    const result = await generateAndStoreInvoice(updatedOrder, customer, {
      lineItems,
      documentLabel: "Facture de confection de CV",
      paymentMethod: updatedOrder.payment_method,
      paymentReference: updatedOrder.payment_reference,
    });
    invoiceNumber = result.invoiceNumber;
    pdfBuffer = result.buffer;

    await supabaseAdmin.from("orders").update({ invoice_url: result.storagePath }).eq("id", updatedOrder.id);

    const { data: signedUrlData } = await supabaseAdmin.storage
      .from("invoices")
      .createSignedUrl(result.storagePath, 60 * 60 * 24 * 7);
    invoiceSignedUrl = signedUrlData?.signedUrl || null;
  } catch (invoiceErr) {
    console.error("[Webhook KPay] Échec génération/stockage de la facture :", invoiceErr?.message);
  }

  if (invoiceNumber) {
    await sendInvoiceEmail({
      to: customer.email,
      fullName: customer.fullName,
      invoiceNumber,
      amount: updatedOrder.amount,
      currency: updatedOrder.currency,
      description: `la confection de votre CV${updatedOrder.has_agent_option ? " avec accompagnement personnalisé" : ""}`,
      pdfBuffer,
    });
    await sendWhatsAppConfirmation({ phone: customer.phone, fullName: customer.fullName, invoiceNumber, invoiceSignedUrl });
  }

  return { handled: true, response: NextResponse.json({ received: true }) };
}

// --- Échecs et annulations (statuts finaux FAILED / CANCELLED documentés
// par KPay, voir https://kpay.site/documentation/webhooks : "Final status.
// COMPLETED FAILED CANCELLED") — jusqu'ici ignorés silencieusement,
// laissant la commande bloquée en "pending" indéfiniment même quand KPay
// confirme un échec réel (ex. solde insuffisant, paiement annulé par le
// client). Fonctions séparées des handlers COMPLETED ci-dessus plutôt que
// fusionnées : pas de facture, pas d'email, pas de crédit à accorder ici,
// seulement refléter fidèlement l'état réel de la commande/transaction.
// Idempotence identique au flux COMPLETED : UPDATE conditionné sur
// payment_status/status = 'pending', un webhook d'échec arrivé en retard ne
// peut jamais écraser une commande déjà marquée payée.
async function handleCvOrderFailure(supabaseAdmin, event, orderId, kpayPaymentId) {
  const orderQuery = supabaseAdmin.from("orders").select("*");
  const { data: order, error: orderError } = orderId
    ? await orderQuery.eq("id", orderId).single()
    : await orderQuery.eq("payment_reference", kpayPaymentId).single();

  if (orderError || !order) return { handled: false };

  const { error: updateError } = await supabaseAdmin
    .from("orders")
    .update({
      payment_status: "failed",
      payment_reference: kpayPaymentId || order.payment_reference,
    })
    .eq("id", order.id)
    .eq("payment_status", "pending");

  if (updateError) {
    console.error("[Webhook KPay] Échec mise à jour (statut d'échec) de la commande :", updateError.message);
    return { handled: true, response: NextResponse.json({ error: "Échec de la mise à jour de la commande." }, { status: 500 }) };
  }

  return { handled: true, response: NextResponse.json({ received: true }) };
}

async function handleCreditTopupFailure(supabaseAdmin, event, transactionId, kpayPaymentId) {
  const transactionQuery = supabaseAdmin.from("transactions").select("*");
  const { data: transaction, error: transactionError } = transactionId
    ? await transactionQuery.eq("id", transactionId).single()
    : await transactionQuery.eq("provider_reference", kpayPaymentId).single();

  if (transactionError || !transaction) return { handled: false };

  const { error: updateError } = await supabaseAdmin
    .from("transactions")
    .update({
      status: "failed",
      provider_reference: kpayPaymentId || transaction.provider_reference,
    })
    .eq("id", transaction.id)
    .eq("status", "pending");

  if (updateError) {
    console.error("[Webhook KPay] Échec mise à jour (statut d'échec) de la transaction :", updateError.message);
    return { handled: true, response: NextResponse.json({ error: "Échec de la mise à jour de la transaction." }, { status: 500 }) };
  }

  return { handled: true, response: NextResponse.json({ received: true }) };
}

// --- Journalisation append-only (table "kpay_webhook_logs") ---
// Chaque webhook signé valide est journalisé avec son payload brut, quel
// que soit son statut — avant même le traitement métier. Sans ça,
// impossible de distinguer a posteriori "KPay n'a jamais notifié" de "KPay
// a notifié un échec qu'on a raté" (constat du 2026-08-17 : commandes
// pending sans aucune trace de ce que KPay avait réellement envoyé).
// Best-effort : un souci d'écriture du journal ne doit jamais empêcher le
// traitement réel du paiement.
async function findMatchingRecord(supabaseAdmin, externalId, kpayPaymentId) {
  const orderQuery = supabaseAdmin.from("orders").select("id");
  const { data: order } = externalId
    ? await orderQuery.eq("id", externalId).maybeSingle()
    : await orderQuery.eq("payment_reference", kpayPaymentId).maybeSingle();
  if (order) return { type: "order", id: order.id };

  const transactionQuery = supabaseAdmin.from("transactions").select("id");
  const { data: transaction } = externalId
    ? await transactionQuery.eq("id", externalId).maybeSingle()
    : await transactionQuery.eq("provider_reference", kpayPaymentId).maybeSingle();
  if (transaction) return { type: "transaction", id: transaction.id };

  return { type: null, id: null };
}

async function logKpayWebhook(supabaseAdmin, event, externalId, kpayPaymentId) {
  try {
    const matched = await findMatchingRecord(supabaseAdmin, externalId, kpayPaymentId);
    await supabaseAdmin.from("kpay_webhook_logs").insert({
      status: event?.status || null,
      amount: typeof event?.amount === "number" ? event.amount : null,
      currency: event?.currency || null,
      kpay_payment_id: kpayPaymentId || null,
      external_id: externalId || null,
      matched_type: matched.type,
      matched_id: matched.id,
      raw_payload: event,
    });
  } catch (err) {
    console.error("[Webhook KPay] Échec journalisation :", err.message);
  }
}

// --- Flux 2 : recharge de crédits générique (table "transactions") ---
async function handleCreditTopupPayment(supabaseAdmin, event, transactionId, kpayPaymentId) {
  const transactionQuery = supabaseAdmin.from("transactions").select("*");
  const { data: transaction, error: transactionError } = transactionId
    ? await transactionQuery.eq("id", transactionId).single()
    : await transactionQuery.eq("provider_reference", kpayPaymentId).single();

  if (transactionError || !transaction) return { handled: false };

  if (typeof event.amount === "number" && event.amount !== Number(transaction.amount)) {
    console.error(`[Webhook KPay] Montant incohérent pour la transaction ${transaction.id} : reçu ${event.amount}, attendu ${transaction.amount}.`);
    return { handled: true, response: NextResponse.json({ received: true, warning: "amount_mismatch" }) };
  }

  if (event.currency && !isEquivalentCfaCurrency(event.currency, transaction.currency)) {
    console.error(`[Webhook KPay] Devise incohérente pour la transaction ${transaction.id} : reçu ${event.currency}, attendu ${transaction.currency}.`);
    return { handled: true, response: NextResponse.json({ received: true, warning: "currency_mismatch" }) };
  }

  const { data: updatedTransactions, error: updateError } = await supabaseAdmin
    .from("transactions")
    .update({ status: "success", provider_reference: kpayPaymentId || transaction.provider_reference })
    .eq("id", transaction.id)
    .eq("status", "pending")
    .select();

  if (updateError) {
    console.error("[Webhook KPay] Échec mise à jour de la transaction :", updateError.message);
    return { handled: true, response: NextResponse.json({ error: "Échec de la mise à jour de la transaction." }, { status: 500 }) };
  }

  if (!updatedTransactions || updatedTransactions.length === 0) {
    return { handled: true, response: NextResponse.json({ received: true, alreadyProcessed: true }) };
  }

  const updatedTransaction = updatedTransactions[0];

  const { data: subscription, error: subSelectError } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("user_id", updatedTransaction.user_id)
    .single();

  if (!subscription && subSelectError?.code === "PGRST116") {
    await supabaseAdmin.from("subscriptions").insert({
      user_id: updatedTransaction.user_id,
      plan_name: updatedTransaction.metadata?.plan_name || "premium",
      credits: 1,
      status: "active",
    });
  } else if (subscription) {
    await supabaseAdmin
      .from("subscriptions")
      .update({
        credits: (subscription.credits || 0) + 1,
        plan_name: updatedTransaction.metadata?.plan_name || subscription.plan_name,
      })
      .eq("id", subscription.id);
  }

  // Reçu (PDF + email) pour la recharge de crédits — même mécanique que les
  // commandes de CV (voir handleCvOrderPayment). Best effort : un échec ici
  // ne doit jamais remettre en cause le crédit déjà accordé ci-dessus.
  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email, phone, contact_email")
      .eq("id", updatedTransaction.user_id)
      .single();

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(updatedTransaction.user_id);

    const customer = {
      fullName: profile?.full_name || authUser?.user?.email || "Client Facilite",
      email: profile?.contact_email || profile?.email || authUser?.user?.email || null,
      phone: profile?.phone || authUser?.user?.phone || event.phoneNumber || null,
    };

    const planName = updatedTransaction.metadata?.plan_name || "Recharge de crédits";
    const result = await generateAndStoreInvoice(updatedTransaction, customer, {
      lineItems: [{ description: `${planName} — crédits IA Facilite`, amount: updatedTransaction.amount }],
      documentLabel: "Reçu de recharge de crédits",
      paymentMethod: "kpay",
      paymentReference: updatedTransaction.provider_reference,
    });

    await supabaseAdmin.from("transactions").update({ invoice_url: result.storagePath }).eq("id", updatedTransaction.id);

    if (customer.email) {
      await sendInvoiceEmail({
        to: customer.email,
        fullName: customer.fullName,
        invoiceNumber: result.invoiceNumber,
        amount: updatedTransaction.amount,
        currency: updatedTransaction.currency,
        description: "la recharge de vos crédits IA Facilite",
        pdfBuffer: result.buffer,
      });
    }
  } catch (invoiceErr) {
    console.error("[Webhook KPay] Échec génération/envoi du reçu de crédits :", invoiceErr?.message);
  }

  return { handled: true, response: NextResponse.json({ received: true }) };
}

export async function POST(req) {
  const userAgent = req.headers.get("user-agent")?.toLowerCase() || "";
  const suspectAgents = ["curl", "postman", "insomnia", "wget", "python-requests", "go-http-client"];
  if (suspectAgents.some((agent) => userAgent.includes(agent))) {
    console.warn(`[Webhook KPay] Tentative bloquée depuis User-Agent suspect : ${userAgent}`);
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const secret = process.env.KPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[Webhook KPay] KPAY_WEBHOOK_SECRET manquant côté serveur.");
    return NextResponse.json({ error: "Webhook non configuré." }, { status: 503 });
  }

  if (isPlaceholderKpaySecret(secret)) {
    console.error(
      "[Webhook KPay] ALERTE : KPAY_WEBHOOK_SECRET ressemble à une valeur de substitution, pas à un vrai " +
        "secret du tableau de bord KPay. Toutes les notifications KPay réelles seront rejetées (signature " +
        "invalide) tant que la vraie valeur n'aura pas été renseignée."
    );
    captureCriticalPaymentError("[Webhook KPay] KPAY_WEBHOOK_SECRET ressemble à un placeholder");
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-kpay-signature");

  if (!isValidKpaySignature(rawBody, signature, secret)) {
    console.error("[Webhook KPay] Signature invalide — requête rejetée.");
    captureCriticalPaymentError("[Webhook KPay] Signature invalide");
    return NextResponse.json({ error: "Signature invalide." }, { status: 401 });
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
    console.error("[Webhook KPay]", err.message);
    captureCriticalPaymentError("[Webhook KPay] Service role manquant", { message: err.message });
    return NextResponse.json({ error: "Webhook non configuré (service role manquant)." }, { status: 503 });
  }

  // externalId porte soit un orders.id (confection de CV), soit un
  // transactions.id (recharge de crédits) — les deux checkouts génèrent des
  // UUID depuis des tables distinctes, aucune collision possible. On essaie
  // "orders" d'abord (flux historique), puis "transactions" seulement si
  // aucune commande ne correspond.
  const externalId = event.externalId;
  const kpayPaymentId = event.paymentId;

  // Journalisation de CHAQUE webhook signé valide, avant tout traitement
  // métier — voir logKpayWebhook ci-dessus.
  await logKpayWebhook(supabaseAdmin, event, externalId, kpayPaymentId);

  if (event?.status === "COMPLETED") {
    try {
      const orderResult = await handleCvOrderPayment(supabaseAdmin, event, externalId, kpayPaymentId);
      if (orderResult.handled) return orderResult.response;

      const transactionResult = await handleCreditTopupPayment(supabaseAdmin, event, externalId, kpayPaymentId);
      if (transactionResult.handled) return transactionResult.response;

      console.error("[Webhook KPay] Ni commande ni transaction introuvable pour externalId/paymentId", externalId, kpayPaymentId);
      captureCriticalPaymentError("[Webhook KPay] Ni commande ni transaction introuvable", { externalId, kpayPaymentId });
      return NextResponse.json({ received: true, warning: "not_found" });
    } catch (error) {
      console.error("[Webhook KPay] Erreur interne :", error);
      captureCriticalPaymentError("[Webhook KPay] Erreur interne", { message: error?.message, externalId, kpayPaymentId });
      return NextResponse.json({ error: "Erreur interne du webhook." }, { status: 500 });
    }
  }

  // Statuts finaux d'échec documentés par KPay (FAILED, CANCELLED) —
  // reflète l'état réel de la commande/transaction au lieu de la laisser
  // bloquée en "pending" indéfiniment.
  if (event?.status === "FAILED" || event?.status === "CANCELLED") {
    try {
      const orderResult = await handleCvOrderFailure(supabaseAdmin, event, externalId, kpayPaymentId);
      if (orderResult.handled) return orderResult.response;

      const transactionResult = await handleCreditTopupFailure(supabaseAdmin, event, externalId, kpayPaymentId);
      if (transactionResult.handled) return transactionResult.response;

      console.error("[Webhook KPay] Ni commande ni transaction introuvable pour externalId/paymentId (échec)", externalId, kpayPaymentId);
      captureCriticalPaymentError("[Webhook KPay] Ni commande ni transaction introuvable (échec)", { externalId, kpayPaymentId });
      return NextResponse.json({ received: true, warning: "not_found" });
    } catch (error) {
      console.error("[Webhook KPay] Erreur interne (échec) :", error);
      captureCriticalPaymentError("[Webhook KPay] Erreur interne (échec)", { message: error?.message, externalId, kpayPaymentId });
      return NextResponse.json({ error: "Erreur interne du webhook." }, { status: 500 });
    }
  }

  // Statut inconnu/non documenté par KPay : accusé de réception, déjà
  // journalisé ci-dessus pour investigation, aucune écriture de statut à
  // l'aveugle sur la commande/transaction.
  return NextResponse.json({ received: true });
}
