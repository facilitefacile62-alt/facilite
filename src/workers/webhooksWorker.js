/**
 * @file webhooksWorker.js
 * @description Consommateur autonome de la file des Webhooks de paiement (PayDunya / KPay).
 * @architecture Traitement idempotent avec table de déduplication (processed_webhooks).
 * Aucune activation automatique de fonctionnalité payante ici — décision produit du
 * 18/08, voir le commentaire dans processWebhookMessage().
 */

const { rabbitmq, QUEUES } = require("../lib/rabbitmq");
const { createClient } = require("@supabase/supabase-js");

const CONCURRENCY = 5;

// Initialisation client Supabase Admin pour les mises à jour financières
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ocfhzwwjvljintabxxlg.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// --- Réconciliation PayDunya (orders / transactions) -----------------
//
// Diagnostic du 21/08 : le webhook PayDunya (src/app/api/pay/paydunya-webhook/route.js)
// confirme déjà authentiquement chaque paiement (re-vérification serveur-à-
// serveur, jamais le corps du POST reçu) puis publie ici via RabbitMQ —
// mais ce worker se contentait jusqu'ici de marquer l'événement "completed"
// sans jamais toucher orders/transactions. Corrigé ci-dessous, en miroir
// de handleCvOrderPayment()/handleCreditTopupPayment() déjà en service
// dans src/app/api/pay/kpay-webhook/route.js (même schéma de tables, même
// idempotence via transition atomique payment_status/status = 'pending').
//
// IMPORTANT — ce correctif ne concerne QUE orders/transactions (confection
// de CV, recharge de crédits). Il ne touche jamais job_offers.is_sponsored/
// sponsored_until/sponsor_priority : voir l'avertissement explicite plus
// bas dans processWebhookMessage(), toujours valable pour le sponsoring.
//
// invoiceGenerator.js/notifications.js/cvModels.js sont écrits en ESM
// (import/export, utilisés tels quels par les Route Handlers Next.js) —
// ce fichier tourne en CommonJS pur (`node src/workers/webhooksWorker.js`,
// hors pipeline de build Next.js, donc hors transpilation). import()
// dynamique plutôt que require() : seul mécanisme qui consomme un module
// ESM depuis du code CommonJS sans convertir ces fichiers partagés (utilisés
// par ailleurs par kpay-webhook/route.js) ni ajouter de dépendance.
async function loadInvoiceHelpers() {
  const [{ generateAndStoreInvoice }, { sendInvoiceEmail, sendWhatsAppConfirmation }, { labelForCvModel }] = await Promise.all([
    import("../lib/invoiceGenerator.js"),
    import("../lib/notifications.js"),
    import("../lib/cvModels.js"),
  ]);
  return { generateAndStoreInvoice, sendInvoiceEmail, sendWhatsAppConfirmation, labelForCvModel };
}

async function resolvePayDunyaCustomer(supabaseAdmin, userId) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, email, phone, contact_email")
    .eq("id", userId)
    .single();
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);

  return {
    fullName: profile?.full_name || authUser?.user?.email || "Client Facilite",
    email: profile?.contact_email || profile?.email || authUser?.user?.email || null,
    phone: profile?.phone || authUser?.user?.phone || null,
  };
}

// --- Flux 1 : confection de CV (table "orders") — miroir de
// handleCvOrderPayment() (kpay-webhook/route.js), adapté à la forme de
// réponse confirmée par confirmPayDunyaInvoice() (payload.invoice.total_amount,
// payload.token, payload.custom_data.external_id).
async function handlePayDunyaOrderPayment(supabaseAdmin, payload, externalId) {
  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", externalId)
    .single();

  if (orderError || !order) return { handled: false };

  const confirmedAmount = payload.invoice?.total_amount;
  if (typeof confirmedAmount === "number" && confirmedAmount !== Number(order.amount)) {
    console.error(`[Worker Webhooks] PayDunya montant incohérent pour la commande ${order.id} : reçu ${confirmedAmount}, attendu ${order.amount}.`);
    return { handled: true };
  }

  const { data: updatedOrders, error: updateError } = await supabaseAdmin
    .from("orders")
    .update({
      payment_status: "paid",
      payment_method: "paydunya",
      payment_reference: payload.token || order.payment_reference,
    })
    .eq("id", order.id)
    .eq("payment_status", "pending")
    .select();

  if (updateError) {
    console.error("[Worker Webhooks] PayDunya échec mise à jour de la commande :", updateError.message);
    return { handled: true };
  }
  if (!updatedOrders || updatedOrders.length === 0) {
    // Déjà réconciliée (webhook rejoué) — idempotence, pas une erreur.
    return { handled: true };
  }

  const updatedOrder = updatedOrders[0];

  if (updatedOrder.has_agent_option) {
    const { error: assignmentError } = await supabaseAdmin.from("agent_assignments").insert({
      order_id: updatedOrder.id,
      candidate_id: updatedOrder.user_id,
      status: "unassigned",
    });
    if (assignmentError) {
      console.error("[Worker Webhooks] PayDunya échec création agent_assignments :", assignmentError.message);
    }
  }

  // Facture + notifications : best-effort, un échec ici ne doit jamais
  // remettre en cause le paiement déjà enregistré ci-dessus.
  try {
    const { generateAndStoreInvoice, sendInvoiceEmail, sendWhatsAppConfirmation, labelForCvModel } = await loadInvoiceHelpers();
    const customer = await resolvePayDunyaCustomer(supabaseAdmin, updatedOrder.user_id);

    const lineItems = [
      { description: `Confection de CV — ${labelForCvModel(updatedOrder.cv_model_id)}`, amount: 1500 },
    ];
    if (updatedOrder.has_agent_option) {
      lineItems.push({ description: "Option accompagnement personnalisé par un expert", amount: 500 });
    }

    const result = await generateAndStoreInvoice(updatedOrder, customer, {
      lineItems,
      documentLabel: "Facture de confection de CV",
      paymentMethod: "paydunya",
      paymentReference: updatedOrder.payment_reference,
    });

    await supabaseAdmin.from("orders").update({ invoice_url: result.storagePath }).eq("id", updatedOrder.id);

    const { data: signedUrlData } = await supabaseAdmin.storage
      .from("invoices")
      .createSignedUrl(result.storagePath, 60 * 60 * 24 * 7);

    if (customer.email) {
      await sendInvoiceEmail({
        to: customer.email,
        fullName: customer.fullName,
        invoiceNumber: result.invoiceNumber,
        amount: updatedOrder.amount,
        currency: updatedOrder.currency,
        description: `la confection de votre CV${updatedOrder.has_agent_option ? " avec accompagnement personnalisé" : ""}`,
        pdfBuffer: result.buffer,
      });
      await sendWhatsAppConfirmation({
        phone: customer.phone,
        fullName: customer.fullName,
        invoiceNumber: result.invoiceNumber,
        invoiceSignedUrl: signedUrlData?.signedUrl || null,
      });
    }
  } catch (invoiceErr) {
    console.error("[Worker Webhooks] PayDunya échec génération/envoi de la facture :", invoiceErr?.message);
  }

  return { handled: true };
}

// --- Flux 2 : recharge de crédits générique (table "transactions") —
// miroir de handleCreditTopupPayment() (kpay-webhook/route.js).
async function handlePayDunyaCreditTopupPayment(supabaseAdmin, payload, externalId) {
  const { data: transaction, error: transactionError } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .eq("id", externalId)
    .single();

  if (transactionError || !transaction) return { handled: false };

  const confirmedAmount = payload.invoice?.total_amount;
  if (typeof confirmedAmount === "number" && confirmedAmount !== Number(transaction.amount)) {
    console.error(`[Worker Webhooks] PayDunya montant incohérent pour la transaction ${transaction.id} : reçu ${confirmedAmount}, attendu ${transaction.amount}.`);
    return { handled: true };
  }

  const { data: updatedTransactions, error: updateError } = await supabaseAdmin
    .from("transactions")
    .update({ status: "success", provider_reference: payload.token || transaction.provider_reference })
    .eq("id", transaction.id)
    .eq("status", "pending")
    .select();

  if (updateError) {
    console.error("[Worker Webhooks] PayDunya échec mise à jour de la transaction :", updateError.message);
    return { handled: true };
  }
  if (!updatedTransactions || updatedTransactions.length === 0) {
    return { handled: true };
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

  try {
    const { generateAndStoreInvoice, sendInvoiceEmail } = await loadInvoiceHelpers();
    const customer = await resolvePayDunyaCustomer(supabaseAdmin, updatedTransaction.user_id);
    const planName = updatedTransaction.metadata?.plan_name || "Recharge de crédits";

    const result = await generateAndStoreInvoice(updatedTransaction, customer, {
      lineItems: [{ description: `${planName} — crédits IA Facilite`, amount: updatedTransaction.amount }],
      documentLabel: "Reçu de recharge de crédits",
      paymentMethod: "paydunya",
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
    console.error("[Worker Webhooks] PayDunya échec génération/envoi du reçu de crédits :", invoiceErr?.message);
  }

  return { handled: true };
}

async function processWebhookMessage(jobData) {
  const { jobId, provider, eventType, payload } = jobData;
  const eventId = payload.eventId || payload.token || payload.id || jobId;

  console.log(`[Worker Webhooks] Début traitement: provider=${provider}, eventId=${eventId}, type=${eventType}`);

  // 1. Vérification d'idempotence (Empêcher le double-traitement en cas de replay)
  const { data: existingEvent } = await supabase
    .from("processed_webhooks")
    .select("id, status")
    .eq("provider", provider)
    .eq("event_id", String(eventId))
    .maybeSingle();

  if (existingEvent) {
    console.log(`[Worker Webhooks] ℹ️ Événement ${eventId} déjà traité précédemment (Idempotence validée). Ignoré.`);
    return { success: true, alreadyProcessed: true };
  }

  // 2. Enregistrement initial dans la table de déduplication
  await supabase.from("processed_webhooks").insert({
    provider,
    event_id: String(eventId),
    event_type: eventType,
    payload,
    status: "processing",
  });

  try {
    // Incident du 18/08 — décision produit explicite : aucune activation
    // automatique du sponsoring via webhook de paiement pour l'instant,
    // tant que KPay n'a pas confirmé un paiement réel abouti en conditions
    // réelles. Ce worker a déjà été utilisé une fois pour écrire directement
    // is_sponsored/sponsored_until/sponsor_priority sur job_offers via la
    // clé service_role — ce qui a nécessité de contourner
    // prevent_sponsorship_self_edit() pour fonctionner (voir migration
    // 20260820130000_restore_sponsorship_trigger.sql). Le seul chemin
    // autorisé pour activer un sponsoring reste set_offer_sponsorship(),
    // appelée manuellement par un admin. Ne jamais réintroduire ici
    // d'écriture directe sur job_offers.is_sponsored/sponsored_until/
    // sponsor_priority : le trigger la bloquera de toute façon, mais elle
    // n'a pas sa place dans ce fichier.
    //
    // 2b. Réconciliation orders/transactions (confection de CV, recharge de
    // crédits) — portée volontairement distincte du sponsoring ci-dessus,
    // jamais concernée par la restriction du 18/08. Seul le statut réellement
    // CONFIRMÉ par confirmPayDunyaInvoice() (jamais le corps du webhook brut)
    // atteint ce point : voir paydunya-webhook/route.js.
    if (provider === "paydunya" && payload.status === "completed") {
      const externalId = payload.custom_data?.external_id;
      if (!externalId) {
        console.error(`[Worker Webhooks] PayDunya ${eventId} : aucun custom_data.external_id, impossible de réconcilier.`);
      } else {
        const orderResult = await handlePayDunyaOrderPayment(supabase, payload, externalId);
        if (!orderResult.handled) {
          const transactionResult = await handlePayDunyaCreditTopupPayment(supabase, payload, externalId);
          if (!transactionResult.handled) {
            console.error(`[Worker Webhooks] PayDunya ${eventId} : ni commande ni transaction introuvable pour external_id=${externalId}.`);
          }
        }
      }
    }
    // Statuts PayDunya autres que "completed" (annulation, échec) : jamais
    // documentés/vérifiés pour ce projet (contrairement à KPay, dont FAILED/
    // CANCELLED sont confirmés par la doc officielle) — volontairement non
    // traités plutôt que de deviner une chaîne de statut et risquer de
    // marquer à tort une commande "failed" sur un statut réel différent.

    // 3. Marquer l'événement comme complété
    await supabase
      .from("processed_webhooks")
      .update({ status: "completed" })
      .eq("provider", provider)
      .eq("event_id", String(eventId));

    console.log(`[Worker Webhooks] ✅ Webhook ${eventId} traité et réconcilié.`);
    return { success: true };
  } catch (err) {
    // Marquer l'échec en base
    await supabase
      .from("processed_webhooks")
      .update({ status: "failed" })
      .eq("provider", provider)
      .eq("event_id", String(eventId));

    throw err;
  }
}

async function startWebhooksWorker() {
  const channel = await rabbitmq.createConsumerChannel(CONCURRENCY);
  console.log(`[Worker Webhooks] 🚀 Écoute active sur '${QUEUES.WEBHOOKS}' (concurrency: ${CONCURRENCY})...`);

  channel.consume(
    QUEUES.WEBHOOKS,
    async (msg) => {
      if (!msg) return;

      try {
        const jobData = JSON.parse(msg.content.toString());
        await processWebhookMessage(jobData);
        channel.ack(msg);
      } catch (err) {
        console.error(`[Worker Webhooks] ❌ Erreur traitement webhook:`, err.message);
        // Nack sans requeue pour router vers la DLQ sans boucle infinie
        channel.nack(msg, false, false);
      }
    },
    { noAck: false }
  );

  return channel;
}

if (require.main === module) {
  require("dotenv").config({ path: ".env.local" });
  startWebhooksWorker().catch((err) => {
    console.error("[Worker Webhooks] Erreur fatale:", err);
    process.exit(1);
  });
}

module.exports = { startWebhooksWorker };
