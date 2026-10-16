import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const FLAG = "feat_marketplace_ia";

/**
 * Garde serveur de l'interrupteur « IA » de la Marketplace (voir migration 20261016340000).
 * Renvoie une réponse 403 si les fonctions IA sont en pause et que l'appelant n'est pas administrateur,
 * sinon null. Un interrupteur introuvable est traité comme coupé (pause par défaut).
 */
export async function refuserSiIaEnPause(req) {
  const admin = getSupabaseAdmin();
  const { data: flag } = await admin.from("feature_flags").select("enabled").eq("id", FLAG).maybeSingle();
  if (flag?.enabled === true) return null;

  const token = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (token) {
    const { data } = await admin.auth.getUser(token);
    const user_id = data?.user?.id;
    if (user_id) {
      const { data: role } = await admin.from("user_roles").select("role").eq("user_id", user_id).maybeSingle();
      if (role?.role === "admin") return null;
    }
  }
  return NextResponse.json(
    { success: false, ia_en_pause: true, error: "Les fonctions IA sont momentanément indisponibles. Elles reviendront bientôt." },
    { status: 403 }
  );
}
