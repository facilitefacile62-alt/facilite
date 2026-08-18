/**
 * @file dlqWorker.js
 * @description Consommateur de la Dead Letter Queue (DLQ) pour surveillance, logging d'erreur et alertes.
 */

const { rabbitmq, QUEUES } = require("../lib/rabbitmq");

async function startDlqWorker() {
  const channel = await rabbitmq.createConsumerChannel(1);
  console.log(`[Worker DLQ] 🛡️ Surveillance active sur la file '${QUEUES.DLQ}'...`);

  channel.consume(
    QUEUES.DLQ,
    async (msg) => {
      if (!msg) return;

      try {
        const payload = JSON.parse(msg.content.toString());
        const deathInfo = msg.properties.headers?.["x-death"] || [];

        console.warn(`[Worker DLQ] ⚠️ Message en échec détecté:`, {
          jobId: payload.jobId,
          deathReason: deathInfo[0]?.reason || "unknown",
          originalQueue: deathInfo[0]?.queue || "unknown",
          timestamp: new Date().toISOString(),
        });

        // Acknowledge après capture de l'alerte pour éviter l'engorgement de la DLQ
        channel.ack(msg);
      } catch (err) {
        console.error(`[Worker DLQ] Erreur traitement DLQ:`, err.message);
        channel.ack(msg);
      }
    },
    { noAck: false }
  );

  return channel;
}

module.exports = { startDlqWorker };
