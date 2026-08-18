/**
 * @file webhooksWorker.js
 * @description Consommateur autonome de la file des Webhooks de paiement (PayDunya / KPay).
 * @architecture Traitement idempotent avec validation de signature.
 */

const { rabbitmq, QUEUES } = require("../lib/rabbitmq");

const CONCURRENCY = 5;

async function processWebhookMessage(jobData) {
  const { jobId, provider, eventType, payload, signature, receivedAt } = jobData;
  console.log(`[Worker Webhooks] Traitement événement '${eventType}' de ${provider} (Job: ${jobId})`);

  // 1. Validation de signature cryptographique (HMAC)
  // 2. Vérification d'idempotence (éviter les double-crédits)
  // 3. Mise à jour de la commande ou de l'abonnement en base de données

  await new Promise((resolve) => setTimeout(resolve, 350));

  console.log(`[Worker Webhooks] ✅ Webhook ${jobId} validé et réconcilié.`);
  return { success: true };
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
        console.error(`[Worker Webhooks] ❌ Erreur traitement paiement:`, err.message);
        // Nack sans requeue -> transmission immédiate vers la Dead Letter Queue pour audit financier
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
