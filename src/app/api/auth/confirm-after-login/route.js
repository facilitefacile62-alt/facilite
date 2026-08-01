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

    const { allowed, error: rateError } = checkRateLimit(user.id);
    if (!allowed) return rateError;

    const updates = {};
    if (user.email && !user.email_confirmed_at) updates.email_confirm = true;
    if (user.phone && !user.phone_confirmed_at) updates.phone_confirm = true;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ confirmed: [] });
    }

    let admin;
    try {
      admin = getSupabaseAdmin();
    } catch (configError) {
      console.error("[Auth] Configuration manquante pour confirm-after-login :", configError.message);
      return NextResponse.json({ error: configError.message }, { status: 502 });
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, updates);

    if (updateError) {
      console.error("[Auth] Échec de confirmation post-connexion :", updateError.message);
      return NextResponse.json({ error: "Échec de la confirmation." }, { status: 500 });
    }

    return NextResponse.json({ confirmed: Object.keys(updates) });
  } catch (err) {
    console.error("[Auth] Erreur interne confirm-after-login :", err);
    return NextResponse.json({ error: "Erreur interne du serveur." }, { status: 500 });
  }
}
