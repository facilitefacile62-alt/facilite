// Alerte chargée à la demande (comme webhookOrange.js) : le module se teste sous Node, hors du serveur Next ; en production l'alerte part comme avant.
async function captureCriticalPaymentError(...args) {
  try {
    const { captureCriticalPaymentError: alerte } = await import("@/lib/sentryAlert");
    alerte(...args);
  } catch {
    console.error("[Paiement] alerte :", ...args);
  }
}

/**
 * Applique à une commande de jetons la confirmation d'Orange (voir evaluerConfirmationOrange dans orangeMoney.js) : la
 * même logique sert au webhook ET au rattrapage, pour que les deux garanties (mêmes conditions, même idempotence)
 * ne puissent jamais diverger.
 *
 * `confirmation.etat` vaut "succes" ou "echec" ici — « attente » et « incoherent » sont traités avant l'appel et ne
 * touchent jamais la commande. L'idempotence tient à la transition atomique pending → success (UPDATE … WHERE
 * status = 'pending') : une commande déjà créditée ne l'est jamais deux fois, quel que soit l'appelant.
 *
 * Retourne { resultat } : "credite" | "echec_enregistre" | "deja_traite" | "doublon_transaction" | "erreur".
 */
export async function appliquerConfirmationAchat(supabaseAdmin, transaction, confirmation, orangeTransactionId) {
  try {
    if (confirmation.etat === "echec") {
      // Échec final confirmé par Orange (FAILED, EXPIRED…) : reflète l'état réel plutôt que de laisser la
      // transaction bloquée en "pending" indéfiniment.
      await supabaseAdmin.from("jetons_transactions").update({ status: "failed" }).eq("id", transaction.id).eq("status", "pending");
      return { resultat: "echec_enregistre" };
    }

    const { data: misesAJour, error: updateError } = await supabaseAdmin
      .from("jetons_transactions")
      .update({
        status: "success",
        provider_reference: orangeTransactionId || transaction.provider_reference,
      })
      .eq("id", transaction.id)
      // « pending » ou « failed » : une commande marquée échouée (tentative refusée, ou plus de 24 h sans nouvelle) dont Orange confirme ensuite un
      // SUCCESS avec la bonne référence ET le bon montant n'a jamais été créditée : elle l'est, UNE seule fois (transition atomique ci-dessous).
      .in("status", ["pending", "failed"])
      .select();

    if (updateError) {
      // Contrainte d'unicité (migration 20261023200000) : un même transactionId Orange ne peut créditer QU'UNE commande.
      if (updateError.code === "23505") {
        console.error("[Jetons Paiement] transactionId Orange déjà utilisé par une autre commande — aucun crédit.");
        captureCriticalPaymentError("[Jetons Paiement] transactionId Orange en double", { transactionId: transaction.id });
        return { resultat: "doublon_transaction" };
      }
      console.error("[Jetons Paiement] Échec mise à jour de la transaction :", updateError.message);
      captureCriticalPaymentError("[Jetons Paiement] Échec mise à jour de la transaction", { message: updateError.message, transactionId: transaction.id });
      return { resultat: "erreur" };
    }
    if (!misesAJour || misesAJour.length === 0) {
      // Déjà passée à "success" par un appel précédent : rien à refaire (jamais de second crédit).
      return { resultat: "deja_traite" };
    }

    const maj = misesAJour[0];
    // Crédit du solde via fonction SECURITY DEFINER dédiée (jamais un UPDATE direct) : upsert atomique
    // store_id -> solde_jetons, respecte la contrainte solde_jetons >= 0 sans course possible.
    const { error: creditError } = await supabaseAdmin.rpc("crediter_jetons_boutique", {
      p_store_id: maj.store_id,
      p_montant: maj.montant,
    });
    if (creditError) {
      console.error("[Jetons Paiement] Échec crédit du solde :", creditError.message);
      captureCriticalPaymentError("[Jetons Paiement] Échec crédit du solde", { message: creditError.message, storeId: maj.store_id, transactionId: transaction.id });
      // Remise à "pending" : la relance d'Orange ou le prochain rattrapage refera tout, au lieu de laisser un
      // achat payé mais jamais crédité.
      await supabaseAdmin.from("jetons_transactions").update({ status: "pending" }).eq("id", transaction.id).eq("status", "success");
      return { resultat: "erreur" };
    }
    return { resultat: "credite" };
  } catch (error) {
    console.error("[Jetons Paiement] Erreur interne :", error);
    captureCriticalPaymentError("[Jetons Paiement] Erreur interne", { message: error?.message, transactionId: transaction?.id });
    return { resultat: "erreur" };
  }
}
