import { traiterNotificationOrange } from "@/lib/webhookOrange";
import { appliquerConfirmationInscription, MONTANT_FORMATION_CV_XOF } from "@/lib/formationCvPaiement";

export const runtime = "nodejs";

// Confirmation de paiement de la formation « Rédaction de CV » via Orange Money « Paiement Marchand » (QR code) — événement
// asynchrone, jamais une réponse directe à l'appel d'initiation (voir formation-cv-checkout/route.js). Même traitement que
// jetons-webhook/route.js (src/lib/webhookOrange.js). `reference` porte notre formation_redaction_cv_inscriptions.id (UUID) ; le montant
// attendu est la constante SERVEUR, jamais une valeur de la ligne d'inscription.
export async function POST(req) {
  return traiterNotificationOrange(req, {
    nom: "Webhook Formation CV",
    tableJournal: "formation_redaction_cv_webhook_events",
    trouverCommande: async (admin, reference) => {
      const { data, error } = await admin
        .from("formation_redaction_cv_inscriptions")
        .select("id, user_id, paye, callback_token_hash")
        .eq("id", reference)
        .maybeSingle();
      return { commande: data, erreur: error };
    },
    empreinteJeton: (commande) => commande.callback_token_hash,
    montantXof: () => MONTANT_FORMATION_CV_XOF,
    appliquer: (admin, commande, confirmation, orangeTransactionId) => appliquerConfirmationInscription(admin, commande, confirmation, orangeTransactionId),
    // Transaction Orange qui a validé l'inscription ; null si elle n'est pas payée.
    transactionCrediteur: async (admin, commande) => {
      const { data } = await admin.from("formation_redaction_cv_inscriptions").select("paye, orange_transaction_id").eq("id", commande.id).maybeSingle();
      return data?.paye ? data.orange_transaction_id ?? null : null;
    },
    champsJournal: (commande) => ({ inscription_id: commande.id }),
  });
}
