/**
 * @file queueProducers.js
 * @description Producteurs de messages (Producers) hautement sécurisés pour les opérations asynchrones.
 */

const crypto = require("crypto");
const { rabbitmq, QUEUES } = require("./rabbitmq");

/**
 * Enfile un traitement d'extraction OCR de pièce d'identité.
 * @security Aucune donnée brute ou PII n'est stockée de façon permanente.
 * @param {object} params
 * @param {string} params.documentId Identifiant unique du document
 * @param {string} params.userId Identifiant de l'utilisateur demandeur
 * @param {string} params.fileStoragePath Chemin sécurisé dans le bucket Supabase
 * @param {string} params.mimeType Type MIME du document (image/png, image/jpeg, application/pdf)
 */
async function enqueueOcrJob({ documentId, userId, fileStoragePath, mimeType }) {
  if (!documentId || !userId || !fileStoragePath) {
    throw new Error("[Producer OCR] Paramètres obligatoires manquants (documentId, userId, fileStoragePath).");
  }

  const correlationId = crypto.randomUUID();
  const jobPayload = {
    jobId: crypto.randomUUID(),
    documentId,
    userId,
    fileStoragePath,
    mimeType: mimeType || "image/jpeg",
    enqueuedAt: new Date().toISOString(),
    retryCount: 0,
  };

  await rabbitmq.publish(QUEUES.OCR, jobPayload, {
    correlationId,
    headers: {
      "x-job-type": "identity_document_ocr",
      "x-user-id": userId,
    },
    priority: 5,
  });

  return { success: true, jobId: jobPayload.jobId, correlationId };
}

/**
 * Enfile l'envoi d'une notification système ou email transactionnel.
 * @param {object} params
 * @param {'email' | 'sms' | 'push'} params.channel Canal de diffusion
 * @param {string} params.recipient Adresse e-mail ou numéro de téléphone
 * @param {string} params.subject Objet du message (pour email)
 * @param {string} params.templateId Nom du template ou type de notification
 * @param {object} params.data Variables d'injection pour le template
 */
async function enqueueNotificationJob({ channel = "email", recipient, subject, templateId, data = {} }) {
  if (!recipient || !templateId) {
    throw new Error("[Producer Notifications] Destinataire ou templateId manquant.");
  }

  const correlationId = crypto.randomUUID();
  const jobPayload = {
    jobId: crypto.randomUUID(),
    channel,
    recipient,
    subject: subject || "Notification Facilité",
    templateId,
    data,
    enqueuedAt: new Date().toISOString(),
  };

  await rabbitmq.publish(QUEUES.NOTIFICATIONS, jobPayload, {
    correlationId,
    headers: {
      "x-notification-channel": channel,
      "x-template-id": templateId,
    },
  });

  return { success: true, jobId: jobPayload.jobId, correlationId };
}

/**
 * Enfile le traitement asynchrone d'un webhook de paiement (PayDunya, KPay, etc.).
 * @param {object} params
 * @param {'paydunya' | 'kpay' | 'wave'} params.provider Fournisseur de paiement
 * @param {string} params.eventType Type d'événement (ex: payment.completed)
 * @param {object} params.payload Données brutes du webhook
 * @param {string} params.signature Signature cryptographique pour vérification
 */
async function enqueueWebhookJob({ provider = "paydunya", eventType, payload, signature }) {
  if (!eventType || !payload) {
    throw new Error("[Producer Webhooks] eventType ou payload manquant.");
  }

  const correlationId = crypto.randomUUID();
  const jobPayload = {
    jobId: crypto.randomUUID(),
    provider,
    eventType,
    payload,
    signature: signature || null,
    receivedAt: new Date().toISOString(),
  };

  await rabbitmq.publish(QUEUES.WEBHOOKS, jobPayload, {
    correlationId,
    headers: {
      "x-payment-provider": provider,
      "x-event-type": eventType,
    },
    priority: 9, // Haute priorité pour les flux financiers
  });

  return { success: true, jobId: jobPayload.jobId, correlationId };
}

module.exports = {
  enqueueOcrJob,
  enqueueNotificationJob,
  enqueueWebhookJob,
};
