/**
 * @file index.js (Worker Runner)
 * @description Orchestrateur principal de tous les Workers RabbitMQ avec gestion du Graceful Shutdown.
 */

require("dotenv").config({ path: ".env.local" });
const { rabbitmq } = require("../lib/rabbitmq");
const { startNotificationsWorker } = require("./notificationsWorker");
const { startWebhooksWorker } = require("./webhooksWorker");
const { startDlqWorker } = require("./dlqWorker");

async function main() {
  console.log("==================================================");
  console.log(" 🐇 [Facilité Background Workers Engine - RabbitMQ]");
  console.log("==================================================");

  try {
    // Initialisation et démarrage des consommateurs
    const channels = await Promise.all([
      startNotificationsWorker(),
      startWebhooksWorker(),
      startDlqWorker(),
    ]);

    console.log("✅ Tous les workers sont initialisés et prêts à consommer les messages.\n");

    // Gestion du Graceful Shutdown
    const shutdown = async (signal) => {
      console.log(`\n🛑 Signal ${signal} reçu. Arrêt gracieux des workers en cours...`);
      try {
        for (const ch of channels) {
          if (ch) await ch.close().catch(() => {});
        }
        await rabbitmq.close();
        console.log("👋 Tous les canaux et connexions ont été fermés proprement. Arrêt du processus.");
        process.exit(0);
      } catch (err) {
        console.error("Erreur lors de l'arrêt gracieux:", err);
        process.exit(1);
      }
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (err) {
    console.error("❌ Erreur fatale au démarrage du cluster de workers:", err);
    process.exit(1);
  }
}

main();
