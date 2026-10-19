import { captureCriticalPaymentError } from "@/lib/sentryAlert";

// Prix de la formation « Rédaction de CV » — constante SERVEUR, jamais lue dans la ligne d'inscription : la colonne
// montant_xof y est posée à l'insertion par le client lui-même (politique d'insertion de l'utilisateur), donc non
// fiable pour contrôler un paiement. Le checkout et le webhook comparent tous deux à CETTE valeur.
export const MONTANT_FORMATION_CV_XOF = 15000;

/**
 * Applique à une inscription la confirmation d'Orange (voir evaluerConfirmationOrange dans orangeMoney.js) — même
 * logique que src/lib/jetonsPaiement.js : « attente » et « incoherent » sont traités avant l'appel et ne touchent
 * jamais l'inscription. L'idempotence tient à la transition atomique paye false → true (UPDATE … WHERE paye = false,
 * lignes renvoyées vérifiées) : une inscription déjà payée n'est jamais « payée » deux fois.
 *
 * Un échec final ne change rien : paye reste false, l'utilisateur peut regénérer un QR (même ligne réutilisée).
 * Retourne { resultat } : "credite" | "echec_enregistre" | "deja_traite" | "erreur".
 */
export async function appliquerConfirmationInscription(supabaseAdmin, inscription, confirmation) {
  try {
    if (confirmation.etat === "echec") return { resultat: "echec_enregistre" };

    const maintenant = new Date().toISOString();
    const { data: misesAJour, error } = await supabaseAdmin
      .from("formation_redaction_cv_inscriptions")
      .update({ paye: true, paye_le: maintenant, updated_at: maintenant })
      .eq("id", inscription.id)
      .eq("paye", false)
      .select("id");

    if (error) {
      console.error("[Formation CV Paiement] Échec mise à jour de l'inscription :", error.message);
      captureCriticalPaymentError("[Formation CV Paiement] Échec mise à jour de l'inscription", { message: error.message, inscriptionId: inscription.id, userId: inscription.user_id });
      return { resultat: "erreur" };
    }
    if (!misesAJour || misesAJour.length === 0) return { resultat: "deja_traite" };
    return { resultat: "credite" };
  } catch (err) {
    console.error("[Formation CV Paiement] Erreur interne :", err);
    captureCriticalPaymentError("[Formation CV Paiement] Erreur interne", { message: err?.message, inscriptionId: inscription?.id });
    return { resultat: "erreur" };
  }
}
