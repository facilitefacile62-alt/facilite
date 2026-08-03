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

    // Empêche toute NOUVELLE connexion tant que le compte est suspendu — le
    // verrou réellement immédiat sur les sessions déjà ouvertes est assuré
    // côté PostgreSQL (current_user_role() renvoie NULL si status <>
    // 'active', voir 20260803040000_moderation_et_suspension.sql) : chaque
    // action privilégiée est revérifiée en base à chaque requête, donc un
    // token déjà émis perd immédiatement ses droits sans attendre son
    // expiration. auth.admin.signOut() n'existe que pour une session
    // précise (un jeton), pas pour "toutes les sessions d'un utilisateur" —
    // inadapté ici, d'où banned_until en complément plutôt qu'en remplacement.
    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      ban_duration: status === "suspended" ? "876000h" : "none",
    });
    if (banError) {
      console.error("[Admin Status API] Échec mise à jour du bannissement:", banError.message);
    }

    await supabaseAdmin.rpc("log_security_event", {
      p_event_type: "user_status_changed",
      p_severity: status === "suspended" ? "warning" : "info",
      p_actor_id: user.id,
      p_target_user_id: targetUserId,
      p_details: { status },
    });

    return NextResponse.json({ success: true, userRole: updated });
  } catch (err) {
    console.error("[Admin Status API Error]", err);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}
