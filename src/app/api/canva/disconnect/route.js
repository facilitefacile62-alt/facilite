import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * DELETE /api/canva/disconnect — appelé via fetch() par le bouton
 * "Déconnecter Canva" (requireUser Bearer s'applique normalement, à
 * l'inverse de /api/canva/auth et /api/canva/callback qui sont atteints
 * par navigation).
 */
export async function DELETE(req) {
  const { user, error: authError } = await requireUser(req);
  if (authError) return authError;

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("canva_tokens").delete().eq("user_id", user.id);

  if (error) {
    console.error("[Canva Disconnect] Échec suppression :", error.message);
    return NextResponse.json({ success: false, error: "Échec de la déconnexion." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
