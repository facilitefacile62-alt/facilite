/**
 * @file webhooksWorker.js
 * @description Consommateur autonome de la file des Webhooks de paiement (PayDunya / KPay).
 * @architecture Traitement 100% idempotent avec table de déduplication et notification automatique.
 */

const { rabbitmq, QUEUES } = require("../lib/rabbitmq");
const { enqueueNotificationJob } = require("../lib/queueProducers");
const { createClient } = require("@supabase/supabase-js");

const CONCURRENCY = 5;

// Initialisation client Supabase Admin pour les mises à jour financières
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ocfhzwwjvljintabxxlg.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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
    // 3. Traitement métier selon le type de paiement (Boost d'offre, Abonnement ou CV)
    const customData = payload.custom_data || {};
    const offerId = customData.offer_id || payload.offer_id;
    const customerEmail = payload.customer?.email || customData.email;

    if (offerId && (payload.status === "completed" || eventType === "payment.success")) {
      // Activer le sponsoring pour l'offre concernée (ex: 7 jours de boost)
      const durationDays = parseInt(customData.duration_days || "7", 10);
      const sponsoredUntil = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

      await supabase
        .from("job_offers")
        .update({
          is_sponsored: true,
          sponsored_until: sponsoredUntil,
          sponsor_priority: parseInt(customData.priority || "10", 10),
        })
        .eq("id", offerId);

      console.log(`[Worker Webhooks] 🚀 Offre ${offerId} sponsorisée avec succès jusqu'au ${sponsoredUntil}`);

      // 4. Déclenchement automatique de la notification utilisateur via RabbitMQ
      if (customerEmail) {
        await enqueueNotificationJob({
          channel: "email",
          recipient: customerEmail,
          subject: "🎉 Votre offre d'emploi est désormais sponsorisée sur Facilité !",
          templateId: "offer_boost_activated",
          data: {
            offerId,
            durationDays,
            sponsoredUntil,
          },
        });
      }
    }

    // 5. Marquer l'événement comme complété
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
