import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isCallerAdmin } from "@/lib/rbac";
import { STATUT_DOUBLE_REMBOURSE, STATUT_PAIEMENT_EN_DOUBLE } from "@/lib/webhookOrange";

export const runtime = "nodejs";

const corpsSchema = z.object({ type: z.enum(["jetons", "formation", "cv"]), evenementId: z.string().uuid() });
const TABLES = { jetons: "jetons_webhook_events", formation: "formation_redaction_cv_webhook_events", cv: "cv_achat_webhook_events" };

/**
 * Marque un paiement EN DOUBLE comme remboursé (il disparaît de la liste « à rembourser »). Aucun mouvement d'argent ici : le
 * remboursement lui-même se fait chez Orange. Réservé aux administrateurs ; ne touche qu'un événement encore au statut DOUBLE_PAIEMENT.
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

    const { data, error } = await admin
      .from(TABLES[corps.data.type])
      .update({ status: STATUT_DOUBLE_REMBOURSE })
      .eq("id", corps.data.evenementId)
      .eq("status", STATUT_PAIEMENT_EN_DOUBLE)
      .select("id");
    if (error) return NextResponse.json({ error: "Mise à jour impossible." }, { status: 500 });
    if (!data?.length) return NextResponse.json({ error: "Paiement en double introuvable ou déjà marqué." }, { status: 404 });
    return NextResponse.json({ marque: true });
  } catch (err) {
    console.error("[Admin Rembourse Orange Error]", err);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}
