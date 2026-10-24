import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isCallerAdmin } from "@/lib/rbac";
import { rechercherTransactionOrange, evaluerConfirmationOrange, messageUtilisateurOrange } from "@/lib/orangeMoney";
import { appliquerConfirmationAchat } from "@/lib/jetonsPaiement";
import { appliquerConfirmationInscription, MONTANT_FORMATION_CV_XOF } from "@/lib/formationCvPaiement";
import { appliquerConfirmationAchatCv } from "@/lib/cvAchatPaiement";
import { captureCriticalPaymentError } from "@/lib/sentryAlert";

export const runtime = "nodejs";

const corpsSchema = z.object({ type: z.enum(["jetons", "formation", "cv"]), id: z.string().uuid() });

/**
 * Relance MANUELLE (admin) de la vérification d'une commande Orange. Exactement les mêmes conditions que le webhook et le rattrapage :
 * recherche de la transaction par NOTRE référence, puis statut Orange ; seul un SUCCESS dont la référence et le montant correspondent
 * à la commande crédite (transition atomique pending → success, jamais deux fois). Aucun paramètre ne permet de forcer un crédit.
 * Réponse : { resultat } = credite | deja_traite | attente | echec_enregistre | incoherent | doublon_transaction | erreur.
 */
export async function POST(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const admin = getSupabaseAdmin();
    if (!(await isCallerAdmin(admin, user.id))) {
      return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
    }

    const corps = corpsSchema.safeParse(await req.json().catch(() => ({})));
    if (!corps.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    const { type, id } = corps.data;

    let commande;
    let montantXof;
    if (type === "jetons") {
      const { data, error } = await admin.from("jetons_transactions").select("*").eq("id", id).eq("type", "achat").maybeSingle();
      if (error) return NextResponse.json({ error: "Lecture impossible." }, { status: 500 });
      if (!data) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
      if (data.status === "success") return NextResponse.json({ resultat: "deja_traite" });
      if (!data.montant_xof) {
        return NextResponse.json({ resultat: "erreur", message: "Commande d'avant la migration : montant non figé, aucune vérification possible." });
      }
      commande = data;
      montantXof = data.montant_xof;
    } else if (type === "cv") {
      const { data, error } = await admin.from("cv_achats").select("*").eq("id", id).maybeSingle();
      if (error) return NextResponse.json({ error: "Lecture impossible." }, { status: 500 });
      if (!data) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
      if (data.status === "success") return NextResponse.json({ resultat: "deja_traite" });
      commande = data;
      montantXof = data.montant_xof;
    } else {
      const { data, error } = await admin.from("formation_redaction_cv_inscriptions").select("*").eq("id", id).maybeSingle();
      if (error) return NextResponse.json({ error: "Lecture impossible." }, { status: 500 });
      if (!data) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
      if (data.paye) return NextResponse.json({ resultat: "deja_traite" });
      commande = data;
      montantXof = MONTANT_FORMATION_CV_XOF;
    }

    let reponse;
    try {
      reponse = await rechercherTransactionOrange({ reference: commande.id });
    } catch (erreur) {
      return NextResponse.json({ resultat: "erreur", message: messageUtilisateurOrange(erreur) });
    }
    const confirmation = evaluerConfirmationOrange(reponse, { reference: commande.id, montantXof });
    if (confirmation.etat === "attente") return NextResponse.json({ resultat: "attente" });
    if (confirmation.etat === "incoherent") {
      captureCriticalPaymentError("[Admin Commandes Orange] Confirmation incohérente avec la commande", { reference: commande.id, motif: confirmation.raison });
      return NextResponse.json({ resultat: "incoherent", message: confirmation.raison });
    }

    const { resultat } =
      type === "jetons"
        ? await appliquerConfirmationAchat(admin, commande, confirmation, reponse?.transactionId)
        : type === "cv"
          ? await appliquerConfirmationAchatCv(admin, commande, confirmation, reponse?.transactionId)
          : await appliquerConfirmationInscription(admin, commande, confirmation, reponse?.transactionId);
    return NextResponse.json({ resultat });
  } catch (err) {
    console.error("[Admin Reverifier Orange Error]", err);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}
