/**
 * @file rabbitmq.js
 * @description Module de connexion RabbitMQ haute résilience (Singleton avec reconnexion automatique).
 * @architecture
 * - Gestion automatique du cycle de vie de la connexion et des canaux.
 * - Déclaration idempotente de l'infrastructure : Queues durables, Dead Letter Exchange (DLX) et Dead Letter Queue (DLQ).
 * - Publication sécurisée avec confirmation et persistance des messages.
 */

const amqp = require("amqplib");

// Configuration des files d'attente et du Dead Letter Exchange
const QUEUES = {
  OCR: "ocr_queue",
  NOTIFICATIONS: "notifications_queue",
  WEBHOOKS: "webhooks_queue",
  DLQ: "dlq_queue",
};

const EXCHANGES = {
  DLX: "facilite.dlx",
};

const ROUTING_KEYS = {
  DEAD_LETTER: "dead.letter",
};

class RabbitMQService {
  constructor() {
    this.connection = null;
    this.publishChannel = null;
    this.isConnecting = false;
    this.reconnectTimeout = null;
    this.reconnectAttempts = 0;
    this.maxReconnectDelayMs = 30000;
  }

  /**
   * Retourne l'URL de connexion RabbitMQ configurée via les variables d'environnement.
   */
  getUrl() {
    return process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";
  }

  /**
   * Établit ou retourne la connexion active (Singleton avec auto-reconnect).
   */
  async getConnection() {
    if (this.connection) return this.connection;

    if (this.isConnecting) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return this.getConnection();
    }

    this.isConnecting = true;
    try {
      const url = this.getUrl();
      const clientProperties = {
        client_properties: {
          connection_name: "ffacilite_backend_service",
          environment: process.env.NODE_ENV || "development",
        },
        heartbeat: 60,
      };

      this.connection = await amqp.connect(url, clientProperties);
      this.reconnectAttempts = 0;
      this.isConnecting = false;

      this.connection.on("error", (err) => {
        console.error("[RabbitMQ] Erreur de connexion:", err.message);
      });

      this.connection.on("close", () => {
        console.warn("[RabbitMQ] Connexion fermée. Tentative de reconnexion...");
        this.connection = null;
        this.publishChannel = null;
        this.scheduleReconnect();
      });

      return this.connection;
    } catch (err) {
      this.isConnecting = false;
      this.connection = null;
      this.publishChannel = null;
      console.error("[RabbitMQ] Échec de connexion:", err.message);
      this.scheduleReconnect();
      throw err;
    }
  }

  /**
   * Planifie une reconnexion avec backoff exponentiel.
   */
  scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

    const delay = Math.min(
      1000 * Math.pow(1.5, this.reconnectAttempts),
      this.maxReconnectDelayMs
    );
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(async () => {
      try {
        console.log(`[RabbitMQ] Tentative de reconnexion #${this.reconnectAttempts}...`);
        await this.getConnection();
        await this.getPublishChannel();
        console.log("[RabbitMQ] Reconnexion réussie et infrastructure rétablie !");
      } catch (e) {
        // La prochaine tentative sera planifiée par le handler catch
      }
    }, delay);
  }

  /**
   * Initialise et déclare l'ensemble des exchanges, files et Dead Letter Queues (DLQ).
   */
  async setupInfrastructure(channel) {
    // 1. Déclaration du Dead Letter Exchange (DLX)
    await channel.assertExchange(EXCHANGES.DLX, "direct", { durable: true });

    // 2. Déclaration de la Dead Letter Queue (DLQ)
    await channel.assertQueue(QUEUES.DLQ, {
      durable: true,
      messageTtl: 7 * 24 * 60 * 60 * 1000, // 7 jours de rétention
    });
    await channel.bindQueue(QUEUES.DLQ, EXCHANGES.DLX, ROUTING_KEYS.DEAD_LETTER);

    // 3. File OCR (Traitement d'identité éphémère + DLQ)
    await channel.assertQueue(QUEUES.OCR, {
      durable: true,
      deadLetterExchange: EXCHANGES.DLX,
      deadLetterRoutingKey: ROUTING_KEYS.DEAD_LETTER,
      messageTtl: 30 * 60 * 1000, // 30 min max dans la file avant DLQ (sécurité)
    });

    // 4. File Notifications (Emails transactionnels & SMS)
    await channel.assertQueue(QUEUES.NOTIFICATIONS, {
      durable: true,
      deadLetterExchange: EXCHANGES.DLX,
      deadLetterRoutingKey: ROUTING_KEYS.DEAD_LETTER,
    });

    // 5. File Webhooks (Paiements PayDunya / KPay)
    await channel.assertQueue(QUEUES.WEBHOOKS, {
      durable: true,
      deadLetterExchange: EXCHANGES.DLX,
      deadLetterRoutingKey: ROUTING_KEYS.DEAD_LETTER,
    });
  }

  /**
   * Retourne le canal dédié à la publication de messages.
   */
  async getPublishChannel() {
    if (this.publishChannel) return this.publishChannel;

    const connection = await this.getConnection();
    this.publishChannel = await connection.createConfirmChannel();

    this.publishChannel.on("error", (err) => {
      console.error("[RabbitMQ] Erreur sur le canal de publication:", err.message);
      this.publishChannel = null;
    });

    this.publishChannel.on("close", () => {
      this.publishChannel = null;
    });

    // Configuration idempotente de la topologie
    await this.setupInfrastructure(this.publishChannel);

    return this.publishChannel;
  }

  /**
   * Crée un nouveau canal dédié pour un Worker / Consommateur spécifique.
   * @param {number} prefetch Nombre de messages pré-chargés simultanément par le worker
   */
  async createConsumerChannel(prefetch = 5) {
    const connection = await this.getConnection();
    const channel = await connection.createChannel();
    await channel.prefetch(prefetch);
    await this.setupInfrastructure(channel);
    return channel;
  }

  /**
   * Publie un message dans une file d'attente de manière sécurisée et persistante.
   * @param {string} queueName Nom de la file d'attente cible
   * @param {object} payload Données du message (sérialisées en JSON)
   * @param {object} options Options avancées (correlationId, headers, priority)
   */
  async publish(queueName, payload, options = {}) {
    const channel = await this.getPublishChannel();
    const contentBuffer = Buffer.from(JSON.stringify(payload));

    const publishOptions = {
      persistent: true, // Écriture sur disque pour survivre à un redémarrage du broker
      timestamp: Date.now(),
      contentType: "application/json",
      contentEncoding: "utf-8",
      ...options,
    };

    return new Promise((resolve, reject) => {
      channel.sendToQueue(queueName, contentBuffer, publishOptions, (err) => {
        if (err) {
          console.error(`[RabbitMQ] Échec de publication dans ${queueName}:`, err.message);
          return reject(err);
        }
        resolve(true);
      });
    });
  }

  /**
   * Fermeture propre de la connexion (Graceful shutdown).
   */
  async close() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    try {
      if (this.publishChannel) {
        await this.publishChannel.close();
        this.publishChannel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      console.log("[RabbitMQ] Connexion fermée proprement.");
    } catch (err) {
      console.warn("[RabbitMQ] Avertissement lors de la fermeture:", err.message);
    }
  }
}

// Export d'une instance unique (Singleton)
const rabbitmq = new RabbitMQService();

module.exports = {
  rabbitmq,
  QUEUES,
  EXCHANGES,
  ROUTING_KEYS,
};
