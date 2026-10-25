import { traiterNotificationOrange } from "@/lib/webhookOrange";
import { appliquerConfirmationAchat } from "@/lib/jetonsPaiement";

export const runtime = "nodejs";

// Confirmation d'achat de jetons Marketplace via Orange Money « Paiement Marchand » (QR code) — événement asynchrone, jamais une
// réponse directe à l'appel d'initiation (voir jetons-checkout/route.js). Toute la logique (filtre par jeton de commande / secret
// global, déduplication, confirmation auprès d'Orange, codes de réponse 202 / 4xx / 5xx) est dans src/lib/webhookOrange.js, commune
// à la formation CV. `reference` porte notre jetons_transactions.id (UUID), envoyé tel quel à la génération du QR code.
export async function POST(req) {
  return traiterNotificationOrange(req, {
    nom: "Webhook Jetons",
    tableJournal: "jetons_webhook_events",
    trouverCommande: async (admin, reference) => {
      const { data, error } = await admin.from("jetons_transactions").select("*").eq("id", reference).eq("type", "achat").maybeSingle();
      return { commande: data, erreur: error };
    },
    empreinteJeton: (commande) => commande.callback_token_hash,
    montantXof: (commande) => commande.montant_xof,
    appliquer: (admin, commande, confirmation, orangeTransactionId) => appliquerConfirmationAchat(admin, commande, confirmation, orangeTransactionId),
    // Transaction Orange qui a crédité la commande (provider_reference vaut le transactionId une fois la commande créditée) ; null sinon.
    transactionCrediteur: async (admin, commande) => {
      const { data } = await admin.from("jetons_transactions").select("status, provider_reference").eq("id", commande.id).maybeSingle();
      return data?.status === "success" ? data.provider_reference ?? null : null;
    },
    champsJournal: (commande) => ({ jetons_transaction_id: commande.id }),
  });
}
