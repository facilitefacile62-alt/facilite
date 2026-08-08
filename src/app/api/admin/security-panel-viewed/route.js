import { NextResponse } from "next/server";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isCallerAdmin } from "@/lib/rbac";

export const runtime = "nodejs";

/**
 * Seul point d'entrée pour journaliser la consultation de l'onglet
 * Sécurité — log_security_event() est restreinte à service_role depuis
 * le 2026-08-08, un client ne peut plus l'appeler directement.
 */
export async function POST(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const supabaseAdmin = getSupabaseAdmin();

    if (!(await isCallerAdmin(supabaseAdmin, user.id))) {
      return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
    }

    const { error: logError } = await supabaseAdmin.rpc("log_security_event", {
      p_event_type: "security_panel_viewed",
      p_severity: "info",
      p_actor_id: user.id,
      p_target_user_id: null,
      p_details: { section: "security" },
    });
    if (logError) {
      // Best-effort, jamais bloquant pour l'utilisateur — même schéma que
      // logAccessDenial (src/lib/apiAuth.js) : un échec de journalisation
      // ne doit pas empêcher l'admin de consulter le panneau.
      console.warn("[Security Panel Viewed API] Échec journalisation (non bloquant):", logError.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Security Panel Viewed API Error]", err);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}
