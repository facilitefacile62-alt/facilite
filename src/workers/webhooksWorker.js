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
