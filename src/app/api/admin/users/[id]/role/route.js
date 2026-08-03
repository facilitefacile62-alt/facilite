import { NextResponse } from "next/server";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isCallerAdmin } from "@/lib/rbac";

export const runtime = "nodejs";

const ALLOWED_ROLES = ["user", "publisher", "admin"];

/**
 * Seul point d'entrée pour changer le rôle d'un utilisateur.
 *
 * user_roles n'accorde aucun privilège UPDATE à "authenticated" (même pour
 * un admin) — voir 20260802050000_rbac_user_roles.sql. C'est un choix
 * délibéré : forcer TOUTE écriture privilégiée à passer par une route
 * serveur qui revérifie explicitement l'autorisation, plutôt que de
 * compter sur une policy RLS différenciant admin/non-admin au niveau
 * client. La route elle-même est publiquement appelable — la vérification
 * "l'appelant est-il admin ?" est donc refaite ici, jamais supposée côté
 * composant.
 */
export async function POST(req, { params }) {
  try {
    const { id: targetUserId } = await params;

    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const body = await req.json().catch(() => ({}));
    const { role } = body;

    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: "Rôle invalide." }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    if (!(await isCallerAdmin(supabaseAdmin, user.id))) {
      return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
    }

    if (targetUserId === user.id && role !== "admin") {
      // Un admin qui se rétrograderait lui-même pourrait se retrouver
      // instantanément sans accès à cette même route pour revenir en
      // arrière (aucune policy authenticated ne permet de se relire soi-même
      // comme admin pour repasser par ici). Filet de sécurité simple :
      // interdit, pas une règle métier du référentiel mais une garde-fou
      // opérationnel évident.
      return NextResponse.json(
        { error: "Vous ne pouvez pas modifier votre propre rôle depuis cette route." },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("user_roles")
      .update({ role, updated_at: new Date().toISOString() })
      .eq("user_id", targetUserId)
      .select()
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
    }

    await supabaseAdmin.rpc("log_security_event", {
      p_event_type: "user_role_changed",
      p_severity: role === "admin" ? "warning" : "info",
      p_actor_id: user.id,
      p_target_user_id: targetUserId,
      p_details: { role },
    });

    return NextResponse.json({ success: true, userRole: updated });
  } catch (err) {
    console.error("[Admin Role API Error]", err);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}
