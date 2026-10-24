import { traiterNotificationOrange } from "@/lib/webhookOrange";
import { adaptateurAchatCv } from "@/lib/cvAchatPaiement";

export const runtime = "nodejs";

// Confirmation d'un achat de modèle de CV via Orange Money « Paiement Marchand » (QR code) — événement asynchrone, jamais une réponse
// directe à l'appel d'initiation (voir cv-checkout/route.js). AUCUNE logique propre : simple adaptateur du traitement commun
// src/lib/webhookOrange.js (jeton de callback ou secret global, journal d'idempotence, confirmation recherche + statut auprès d'Orange,
// 202 / 4xx / 503, détection des paiements en double), comme jetons-webhook et formation-cv-webhook. `reference` porte cv_achats.id (UUID).
export async function POST(req) {
  return traiterNotificationOrange(req, adaptateurAchatCv);
}
