import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { rechercherTransactionOrange, evaluerConfirmationOrange } from "@/lib/orangeMoney";
import { appliquerConfirmationAchat } from "@/lib/jetonsPaiement";
import { captureCriticalPaymentError } from "@/lib/sentryAlert";
import { bearerValide } from "@/lib/cronAuth";

export const runtime = "nodejs";

// Une commande « pending » n'est reprise qu'après ce délai (le QR code vit 15 minutes et la notification d'Orange arrive
// normalement dans la minute qui suit le paiement). Orange garantit un statut final sous 24 h : au-delà, une commande que ni la
// recherche ni l'API de statut ne donnent comme payée est marquée « failed » (expirée) — jamais laissée « pending » indéfiniment.
const DELAI_MIN_MINUTES = 20;
const FENETRE_MAX_HEURES = 24;
const LOT_MAX = 50;

/**
 * Rattrapage des achats de jetons restés « pending » : si Orange ne renvoie jamais de notification, un paiement réel
 * ne doit pas rester sans crédit. Mêmes conditions que le webhook (statut SUCCESS, référence ET montant identiques à la
 * commande, commande encore pending — voir evaluerConfirmationOrange et appliquerConfirmationAchat) et même
 * idempotence : une commande déjà créditée par le webhook n'est jamais créditée une seconde fois.
 *
 * Prévu pour tourner toutes les 10 minutes. Le planificateur n'est PAS branché : le plan Vercel (Hobby) n'autorise
 * qu'un cron quotidien. Protégée par CRON_SECRET ou RATTRAPAGE_CRON_SECRET (Bearer).
 */
export async function GET(req) {
  // Deux secrets acceptés : CRON_SECRET (celui des autres routes cron) et RATTRAPAGE_CRON_SECRET, dédié au planificateur
  // GitHub Actions de cette route (révocable sans toucher aux autres crons). Comparaison en temps constant.
  const secrets = [process.env.CRON_SECRET, process.env.RATTRAPAGE_CRON_SECRET];
  if (!secrets.some(Boolean)) {
    console.error("[Cron Rattrapage Jetons] Aucun secret (CRON_SECRET / RATTRAPAGE_CRON_SECRET) côté serveur.");
    return NextResponse.json({ error: "Cron non configuré." }, { status: 503 });
  }
  if (!bearerValide(req.headers.get("authorization"), secrets)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (configError) {
    console.error("[Cron Rattrapage Jetons] Configuration manquante :", configError.message);
    return NextResponse.json({ error: configError.message }, { status: 502 });
  }

  const maintenant = Date.now();
  const avant = new Date(maintenant - DELAI_MIN_MINUTES * 60_000).toISOString();
  const limiteExpiration = maintenant - FENETRE_MAX_HEURES * 3_600_000;

  const { data: commandes, error } = await admin
    .from("jetons_transactions")
    .select("*")
    .eq("type", "achat")
    .eq("status", "pending")
    .lt("created_at", avant)
    .order("created_at", { ascending: true })
    .limit(LOT_MAX);
  if (error) {
    console.error("[Cron Rattrapage Jetons] Lecture impossible :", error.message);
    return NextResponse.json({ error: "Lecture impossible." }, { status: 500 });
  }

  const bilan = { examinees: commandes.length, creditees: 0, echecs: 0, en_attente: 0, expirees: 0, incoherentes: 0, sans_montant: 0, erreurs: 0 };
  for (const commande of commandes) {
    // Commande d'avant la migration : pas de montant figé, donc pas de contrôle possible — jamais créditée par ici.
    if (!commande.montant_xof) {
      bilan.sans_montant += 1;
      continue;
    }
    try {
      // Recherche par NOTRE référence (GET /transactions?reference=…), puis API de statut sur le transactionId trouvé : mêmes
      // conditions que le webhook. Aucun repli sur la notification ici (il n'y en a pas) : sans recherche autorisée, pas de crédit.
      const reponse = await rechercherTransactionOrange({ reference: commande.id });
      const confirmation = evaluerConfirmationOrange(reponse, { reference: commande.id, montantXof: commande.montant_xof });
      if (confirmation.etat === "attente") {
        if (new Date(commande.created_at).getTime() < limiteExpiration) {
          // Plus de 24 h sans paiement abouti : commande expirée (jamais créditée), le client peut en créer une nouvelle.
          await admin.from("jetons_transactions").update({ status: "failed" }).eq("id", commande.id).eq("status", "pending");
          bilan.expirees += 1;
        } else {
          bilan.en_attente += 1;
        }
      } else if (confirmation.etat === "incoherent") {
        bilan.incoherentes += 1;
        captureCriticalPaymentError("[Cron Rattrapage Jetons] Confirmation incohérente avec la commande", { reference: commande.id, motif: confirmation.raison });
      } else {
        const { resultat } = await appliquerConfirmationAchat(admin, commande, confirmation, reponse?.transactionId);
        if (resultat === "credite") bilan.creditees += 1;
        else if (resultat === "echec_enregistre") bilan.echecs += 1;
        else if (resultat === "erreur") bilan.erreurs += 1;
      }
    } catch (err) {
      bilan.erreurs += 1;
      console.error("[Cron Rattrapage Jetons] Confirmation impossible pour une commande :", err.message);
    }
  }

  return NextResponse.json(bilan);
}
