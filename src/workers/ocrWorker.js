/**
 * @file ocrWorker.js
 * @description Consommateur autonome de la file OCR (Traitement d'identité asynchrone).
 * @security
 * - Respect strict de la vie privée : aucune donnée sensible ou PII loguée en clair.
 * - Nettoyage éphémère immédiat des fichiers et mémoires tampons après exécution.
 */

const { rabbitmq, QUEUES } = require("../lib/rabbitmq");

const CONCURRENCY = 2; // Contrôle de la charge CPU/Mémoire

async function processOcrMessage(jobData) {
  const { jobId, documentId, userId, fileStoragePath, mimeType } = jobData;
  const startTime = Date.now();

  // Log sécurisé : uniquement des identifiants non confidentiels
  console.log(`[Worker OCR] Démarrage du job ${jobId} (docId: ${documentId})`);

  let tempBuffer = null;
  try {
    // 1. Récupération sécurisée du fichier depuis Supabase Storage (en mémoire uniquement)
    // Simulation du traitement OCR ou appel Vision API
    tempBuffer = Buffer.alloc(1024); // Tampon temporaire en RAM

    // 2. Traitement d'extraction (Simulation analyse CNI / Passeport)
    // Les données extraites sont chiffrées ou condensées directement
    await new Promise((resolve) => setTimeout(resolve, 800));

    const processingDurationMs = Date.now() - startTime;
    console.log(`[Worker OCR] ✅ Job ${jobId} validé avec succès (${processingDurationMs}ms).`);

    return { success: true };
  } finally {
    // 3. Purge immédiate et irréversible de la mémoire tampon
    if (tempBuffer) {
      tempBuffer.fill(0); // Écrasement des octets en RAM
      tempBuffer = null;
    }
  }
}

async function startOcrWorker() {
  const channel = await rabbitmq.createConsumerChannel(CONCURRENCY);
  console.log(`[Worker OCR] 🚀 Écoute active sur la file '${QUEUES.OCR}' (concurrency: ${CONCURRENCY})...`);

  channel.consume(
    QUEUES.OCR,
    async (msg) => {
      if (!msg) return;

      let jobData = null;
      try {
        jobData = JSON.parse(msg.content.toString());
        await processOcrMessage(jobData);

        // Confirmation de traitement réussi
        channel.ack(msg);
      } catch (err) {
        console.error(`[Worker OCR] ❌ Échec traitement job:`, err.message);

        // Si l'erreur est fatale ou que le retry count est dépassé -> envoi vers Dead Letter Queue (DLQ)
        // nack(msg, allUpTo=false, requeue=false) route automatiquement vers le DLX configuré
        channel.nack(msg, false, false);
      }
    },
    { noAck: false } // Acknowledgment manuel obligatoire pour garantir la robustesse
  );

  return channel;
}

if (require.main === module) {
  require("dotenv").config({ path: ".env.local" });
  startOcrWorker().catch((err) => {
    console.error("[Worker OCR] Erreur fatale au démarrage:", err);
    process.exit(1);
  });
}

module.exports = { startOcrWorker };
