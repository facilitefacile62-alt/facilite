/**
 * @file notificationsWorker.js
 * @description Consommateur autonome de la file des notifications (Emails & SMS).
 */

const { rabbitmq, QUEUES } = require("../lib/rabbitmq");

const CONCURRENCY = 10;

async function processNotificationMessage(jobData) {
  const { jobId, channel, recipient, subject, templateId, data } = jobData;
  console.log(`[Worker Notifications] Envoi ${channel} vers ${recipient} (Template: ${templateId}, Job: ${jobId})`);

  // Simulation d'envoi d'e-mail transactionnel (ex: Resend) ou SMS (ex: Twilio)
  await new Promise((resolve) => setTimeout(resolve, 200));

  console.log(`[Worker Notifications] ✅ Notification ${jobId} transmise avec succès.`);
  return { success: true };
}

async function startNotificationsWorker() {
  const channel = await rabbitmq.createConsumerChannel(CONCURRENCY);
  console.log(`[Worker Notifications] 🚀 Écoute active sur '${QUEUES.NOTIFICATIONS}' (concurrency: ${CONCURRENCY})...`);

  channel.consume(
    QUEUES.NOTIFICATIONS,
    async (msg) => {
      if (!msg) return;

      try {
        const jobData = JSON.parse(msg.content.toString());
        await processNotificationMessage(jobData);
        channel.ack(msg);
      } catch (err) {
        console.error(`[Worker Notifications] ❌ Erreur envoi:`, err.message);
        // En cas d'erreur de transmission, transfert en DLQ pour inspection
        channel.nack(msg, false, false);
      }
    },
    { noAck: false }
  );

  return channel;
}

if (require.main === module) {
  require("dotenv").config({ path: ".env.local" });
  startNotificationsWorker().catch((err) => {
    console.error("[Worker Notifications] Erreur fatale:", err);
    process.exit(1);
  });
}

module.exports = { startNotificationsWorker };
