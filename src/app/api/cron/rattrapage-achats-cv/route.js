import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { rechercherTransactionOrange, evaluerConfirmationOrange } from "@/lib/orangeMoney";
import { appliquerConfirmationAchatCv } from "@/lib/cvAchatPaiement";
import { captureCriticalPaymentError } from "@/lib/sentryAlert";
import { bearerValide } from "@/lib/cronAuth";

export const runtime = "nodejs";

// Mêmes délais que rattrapage-achats-jetons : un achat « pending » n'est repris qu'après 20 minutes ; Orange garantit un statut final sous 24 h.
const DELAI_MIN_MINUTES = 20;
const FENETRE_MAX_HEURES = 24;
const LOT_MAX = 50;

/**
 * Rattrapage des achats de modèles de CV dont la notification d'Orange ne serait jamais arrivée (ou arrivée avant la recherche) : un paiement
 * réel ne doit pas rester sans achat. Mêmes conditions que le webhook (statut SUCCESS, référence ET montant identiques à la commande) et même
 * idempotence (appliquerConfirmationAchatCv). Reprend aussi les achats déjà marqués « failed » depuis moins de 24 h dont un QR avait été
 * créé : une nouvelle demande de l'acheteur ferme l'ancien QR côté base, mais un paiement fait avec cet ancien QR doit quand même être validé.
 *
 * Prévu pour tourner toutes les 10 minutes (même planificateur GitHub Actions que les jetons). Protégée par CRON_SECRET ou
 * RATTRAPAGE_CRON_SECRET (Bearer).
 */
export async function GET(req) {
  const secrets = [process.env.CRON_SECRET, process.env.RATTRAPAGE_CRON_SECRET];
  if (!secrets.some(Boolean)) {
    console.error("[Cron Rattrapage CV] Aucun secret (CRON_SECRET / RATTRAPAGE_CRON_SECRET) côté serveur.");
    return NextResponse.json({ error: "Cron non configuré." }, { status: 503 });
  }
  if (!bearerValide(req.headers.get("authorization"), secrets)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (configError) {
    console.error("[Cron Rattrapage CV] Configuration manquante :", configError.message);
    return NextResponse.json({ error: configError.message }, { status: 502 });
  }

  const maintenant = Date.now();
  const avant = new Date(maintenant - DELAI_MIN_MINUTES * 60_000).toISOString();
  const limiteExpiration = maintenant - FENETRE_MAX_HEURES * 3_600_000;
  const depuis = new Date(limiteExpiration).toISOString();

  const [enAttente, echouesRecents] = await Promise.all([
    admin.from("cv_achats").select("*").eq("status", "pending").lt("created_at", avant).order("created_at", { ascending: true }).limit(LOT_MAX),
    admin.from("cv_achats").select("*").eq("status", "failed").not("provider_reference", "is", null).gt("created_at", depuis).order("created_at", { ascending: true }).limit(LOT_MAX),
  ]);
  if (enAttente.error || echouesRecents.error) {
    console.error("[Cron Rattrapage CV] Lecture impossible :", enAttente.error?.message || echouesRecents.error?.message);
    return NextResponse.json({ error: "Lecture impossible." }, { status: 500 });
  }
  const commandes = [...enAttente.data, ...echouesRecents.data];

  const bilan = { examinees: commandes.length, validees: 0, echecs: 0, en_attente: 0, expirees: 0, incoherentes: 0, deja_traitees: 0, erreurs: 0 };
  for (const commande of commandes) {
    try {
      const reponse = await rechercherTransactionOrange({ reference: commande.id });
      const confirmation = evaluerConfirmationOrange(reponse, { reference: commande.id, montantXof: commande.montant_xof });
      if (confirmation.etat === "attente") {
        if (commande.status === "pending" && new Date(commande.created_at).getTime() < limiteExpiration) {
          // Plus de 24 h sans paiement abouti : achat expiré (jamais validé), l'acheteur peut en créer un nouveau.
          await admin.from("cv_achats").update({ status: "failed" }).eq("id", commande.id).eq("status", "pending");
          bilan.expirees += 1;
        } else {
          bilan.en_attente += 1;
        }
      } else if (confirmation.etat === "incoherent") {
        bilan.incoherentes += 1;
        captureCriticalPaymentError("[Cron Rattrapage CV] Confirmation incohérente avec la commande", { reference: commande.id, motif: confirmation.raison });
      } else {
        const { resultat } = await appliquerConfirmationAchatCv(admin, commande, confirmation, reponse?.transactionId);
        if (resultat === "credite") bilan.validees += 1;
        else if (resultat === "echec_enregistre") bilan.echecs += 1;
        else if (resultat === "deja_traite") bilan.deja_traitees += 1;
        else if (resultat === "erreur") bilan.erreurs += 1;
      }
    } catch (err) {
      bilan.erreurs += 1;
      console.error("[Cron Rattrapage CV] Confirmation impossible pour une commande :", err.message);
    }
  }

  return NextResponse.json(bilan);
}
