import { NextResponse } from "next/server";
import { requireUser, checkRateLimit } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// Supabase ne confirme email_confirmed_at/phone_confirmed_at automatiquement
// qu'après vérification d'un OTP ou d'un lien magique — jamais après une
// connexion par mot de passe. Cette route comble cet écart : appelée juste
// après un signInWithPassword réussi, elle confirme UNIQUEMENT l'identifiant
// déjà présent et non confirmé sur l'utilisateur authentifié par son propre
// JWT (jamais un userId fourni par le client) — impossible de forcer la
// confirmation du compte de quelqu'un d'autre.
export async function POST(req) {
  try {
    const { user, error: authError } = await requireUser(req);
    if (authError) return authError;

    const { allowed, error: rateError } = await checkRateLimit(user.id);
    if (!allowed) return rateError;

    const updates = {};
    if (user.email && !user.email_confirmed_at) updates.email_confirm = true;
    if (user.phone && !user.phone_confirmed_at) updates.phone_confirm = true;

    let admin;
    try {
      admin = getSupabaseAdmin();
    } catch (configError) {
      console.error("[Auth] Configuration manquante pour confirm-after-login :", configError.message);
      return NextResponse.json({ error: configError.message }, { status: 502 });
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await admin.auth.admin.updateUserById(user.id, updates);
      if (updateError) {
        console.error("[Auth] Échec de confirmation post-connexion :", updateError.message);
        return NextResponse.json({ error: "Échec de la confirmation." }, { status: 500 });
      }
    }

    // Se reconnecter annule une suppression de compte en attente (Section
    // 3b "Supprimer le compte" du profil) — best-effort, ne bloque jamais
    // la connexion.
    let deletionCancelled = false;
    try {
      const { data: cancelled, error: cancelError } = await admin
        .from("profiles")
        .update({ deleted_at: null })
        .eq("id", user.id)
        .not("deleted_at", "is", null)
        .select("id");
      if (cancelError) throw cancelError;
      if (cancelled && cancelled.length > 0) {
        deletionCancelled = true;
        await admin.rpc("log_security_event", {
          p_event_type: "account_deletion_cancelled",
          p_severity: "info",
          p_actor_id: user.id,
          p_target_user_id: null,
          p_details: {},
        });
      }
    } catch (err) {
      console.warn("[Auth] Échec annulation suppression en attente (non bloquant) :", err.message);
    }

    return NextResponse.json({ confirmed: Object.keys(updates), deletionCancelled });
  } catch (err) {
    console.error("[Auth] Erreur interne confirm-after-login :", err);
    return NextResponse.json({ error: "Erreur interne du serveur." }, { status: 500 });
  }
}
