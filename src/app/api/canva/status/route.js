import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * GET /api/canva/status — l'access_token ne doit jamais atteindre le
 * navigateur (RLS autoriserait techniquement le propriétaire à le
 * SELECT, mais le transmettre au client l'exposerait inutilement au
 * réseau/JS) : cette route le lit et l'utilise côté serveur uniquement,
 * ne renvoie qu'un booléen.
 *
 * Une ligne canva_tokens peut exister mais être inutilisable (révoquée
 * côté Canva sans que expires_at ait changé — constaté en conditions
 * réelles) : un simple SELECT ne suffit pas à savoir si l'utilisateur est
 * "vraiment" connecté.
 */
export async function GET(req) {
  const { user, error: authError } = await requireUser(req);
  if (authError) return authError;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("canva_tokens")
    .select("access_token, expires_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[Canva Status] Échec lecture :", error.message);
    return NextResponse.json({ connected: false });
  }

  if (!data) return NextResponse.json({ connected: false });

  if (new Date(data.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ connected: false });
  }

  // Appel léger pour détecter une révocation côté Canva, invisible tant
  // qu'on ne regarde que expires_at (un token révoqué garde sa date
  // d'expiration d'origine). Une erreur réseau ici ne doit pas faire
  // disparaître le badge "connecté" à tort — seul un 401 explicite compte.
  try {
    const checkResponse = await fetch("https://api.canva.com/rest/v1/users/me", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (checkResponse.status === 401) {
      return NextResponse.json({ connected: false });
    }
  } catch (err) {
    console.error("[Canva Status] Échec de la vérification légère (non bloquant) :", err.message);
  }

  return NextResponse.json({ connected: true });
}
