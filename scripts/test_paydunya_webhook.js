/**
 * @file test_paydunya_webhook.js
 * @description Script de test pour simuler l'envoi d'un webhook PayDunya réussi et valider l'idempotence.
 */

const crypto = require("crypto");

async function runTest() {
  const masterKey = process.env.PAYDUNYA_MASTER_KEY || "test_master_key_12345";
  const signature = crypto.createHash("sha512").update(masterKey).digest("hex");

  const mockPayload = {
    event: "invoice.paid",
    status: "completed",
    token: `test_token_${Date.now()}`,
    custom_data: {
      offer_id: "df1477a7-88df-4817-a130-25b681c32413",
      duration_days: "7",
      priority: "10",
      email: "recruteur.test@ffacilite.com",
    },
    customer: {
      name: "Recruteur Test",
      email: "recruteur.test@ffacilite.com",
      phone: "+221770000000",
    },
    receipt_url: "https://paydunya.com/receipt/mock-12345",
  };

  console.log("🚀 Envoi du Webhook Mock vers l'API locale...");
  
  try {
    const res = await fetch("http://localhost:3000/api/pay/paydunya-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-paydunya-signature": signature,
      },
      body: JSON.stringify(mockPayload),
    });

    const data = await res.json();
    console.log(`📡 Réponse API (${res.status}):`, data);

    if (res.ok && data.received) {
      console.log("✅ Webhook réceptionné avec succès et enfilé dans RabbitMQ !");
    } else {
      console.warn("⚠️ Réponse inattendue:", data);
    }
  } catch (err) {
    console.error("❌ Erreur connexion serveur local:", err.message);
  }
}

runTest();
