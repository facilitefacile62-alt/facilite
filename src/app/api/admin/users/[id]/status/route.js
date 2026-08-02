import { NextResponse } from "next/server";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isCallerAdmin } from "@/lib/rbac";

export const runtime = "nodejs";

const ALLOWED_STATUSES = ["active", "pending_review", "suspended"];

/** Seul point d'entrée pour changer le statut d'un utilisateur — même
 * raisonnement que /api/admin/users/[id]/role (voir ce fichier). */
export async function POST(req, { params }) {
  try {
    const { id: targetUserId } = await params;

    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const body = await req.json().catch(() => ({}));
    const { status } = body;

    if (!ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    if (!(await isCallerAdmin(supabaseAdmin, user.id))) {
      return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
    }

    if (targetUserId === user.id && status === "suspended") {
      return NextResponse.json(
        { error: "Vous ne pouvez pas vous suspendre vous-même." },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("user_roles")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("user_id", targetUserId)
      .select()
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
    }

    // TODO (section 6, pas encore construite) : journaliser dans audit_log.

    return NextResponse.json({ success: true, userRole: updated });
  } catch (err) {
    console.error("[Admin Status API Error]", err);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}
