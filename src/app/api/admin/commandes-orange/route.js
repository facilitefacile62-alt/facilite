import { NextResponse } from "next/server";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isCallerAdmin } from "@/lib/rbac";
import { MONTANT_FORMATION_CV_XOF } from "@/lib/formationCvPaiement";

export const runtime = "nodejs";

const LOT_MAX = 100;

/**
 * Suivi ADMIN des commandes Orange Money : achats de jetons et inscriptions à la formation CV en attente de paiement (« pending » / non
 * payées) ou échouées. Lecture seule : aucun crédit ici (voir ./reverifier pour relancer la vérification auprès d'Orange). Les empreintes
 * de jetons de callback ne sont jamais renvoyées.
 */
export async function GET(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const admin = getSupabaseAdmin();
    if (!(await isCallerAdmin(admin, user.id))) {
      return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
    }

    const [achats, formations] = await Promise.all([
      admin
        .from("jetons_transactions")
        .select("id, store_id, montant, montant_xof, status, provider_reference, created_at")
        .eq("type", "achat")
        .in("status", ["pending", "failed"])
        .order("created_at", { ascending: false })
        .limit(LOT_MAX),
      admin
        .from("formation_redaction_cv_inscriptions")
        .select("id, user_id, paye, orange_transaction_id, created_at, updated_at")
        .eq("paye", false)
        .not("callback_token_hash", "is", null)
        .order("updated_at", { ascending: false })
        .limit(LOT_MAX),
    ]);
    if (achats.error || formations.error) {
      console.error("[Admin Commandes Orange] Lecture impossible :", achats.error?.message || formations.error?.message);
      return NextResponse.json({ error: "Lecture impossible." }, { status: 500 });
    }

    return NextResponse.json({
      jetons: achats.data.map((c) => ({
        id: c.id,
        etat: c.status,
        montantXof: c.montant_xof ?? null,
        jetons: c.montant,
        transactionOrange: c.provider_reference ?? null,
        creeLe: c.created_at,
        magasin: c.store_id,
      })),
      formations: formations.data.map((c) => ({
        id: c.id,
        etat: "pending",
        montantXof: MONTANT_FORMATION_CV_XOF,
        transactionOrange: c.orange_transaction_id ?? null,
        creeLe: c.updated_at || c.created_at,
        utilisateur: c.user_id,
      })),
    });
  } catch (err) {
    console.error("[Admin Commandes Orange Error]", err);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}
