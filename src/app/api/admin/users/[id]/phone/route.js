import { NextResponse } from "next/server";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isCallerAdmin } from "@/lib/rbac";

export const runtime = "nodejs";

/**
 * Seul point d'entrée pour dissocier le numéro de téléphone (auth.users.phone,
 * connexion SMS/OTP) d'un compte — même raisonnement que
 * /api/admin/users/[id]/status : auth.admin.updateUserById nécessite
 * service_role, impossible depuis le client. Le numéro complet ne transite
 * jamais que côté serveur ; seule sa version masquée (mask_phone_number)
 * atteint security_logs.
 */
export async function POST(req, { params }) {
  try {
    const { id: targetUserId } = await params;

    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const supabaseAdmin = getSupabaseAdmin();

    if (!(await isCallerAdmin(supabaseAdmin, user.id))) {
      return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
    }

    const { data: targetData, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
    if (fetchError || !targetData?.user) {
      return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
    }
    if (!targetData.user.phone) {
      return NextResponse.json({ error: "Ce compte n'a aucun numéro de téléphone associé." }, { status: 400 });
    }

    const { data: phoneMasked } = await supabaseAdmin.rpc("mask_phone_number", { p_phone: targetData.user.phone });

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, { phone: "" });
    if (updateError) {
      return NextResponse.json({ error: "Échec de la dissociation : " + updateError.message }, { status: 500 });
    }

    const { error: logError } = await supabaseAdmin.rpc("log_security_event", {
      p_event_type: "admin_phone_unlinked",
      p_severity: "warning",
      p_actor_id: user.id,
      p_target_user_id: targetUserId,
      p_details: { phone_masked: phoneMasked || null },
    });
    if (logError) {
      // Best-effort, jamais bloquant — même schéma que le reste des routes admin.
      console.warn("[Admin Phone Unlink API] Échec journalisation (non bloquant):", logError.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Admin Phone Unlink API Error]", err);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}
