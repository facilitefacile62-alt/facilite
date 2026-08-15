import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/**
 * POST /api/canva/refresh — appelé via fetch() par le frontend avant un
 * appel Autofill, donc requireUser() (Bearer) s'applique normalement ici,
 * contrairement à /api/canva/auth et /api/canva/callback.
 */
export async function POST(req) {
  const { user, error: authError } = await requireUser(req);
  if (authError) return authError;

  const admin = getSupabaseAdmin();

  const { data: tokenRow, error: selectError } = await admin
    .from("canva_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (selectError) {
    console.error("[Canva Refresh] Échec lecture du token :", selectError.message);
    return NextResponse.json({ error: "Échec de lecture du token Canva." }, { status: 500 });
  }

  if (!tokenRow) {
    return NextResponse.json({ error: "Non connecté à Canva." }, { status: 401 });
  }

  const expiresAt = new Date(tokenRow.expires_at).getTime();
  const stillValid = expiresAt - Date.now() > REFRESH_MARGIN_MS;

  if (stillValid) {
    return NextResponse.json({ access_token: tokenRow.access_token, expires_at: tokenRow.expires_at });
  }

  if (!tokenRow.refresh_token) {
    return NextResponse.json({ error: "Token Canva expiré, aucun refresh_token disponible. Reconnectez Canva." }, { status: 401 });
  }

  let tokenData;
  try {
    const tokenResponse = await fetch("https://api.canva.com/rest/v1/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokenRow.refresh_token,
        client_id: process.env.CANVA_CLIENT_ID,
        client_secret: process.env.CANVA_CLIENT_SECRET,
      }),
      cache: "no-store",
    });

    tokenData = await tokenResponse.json().catch(() => null);

    if (!tokenResponse.ok || !tokenData?.access_token) {
      console.error("[Canva Refresh] Échec rafraîchissement :", tokenResponse.status, tokenData);
      return NextResponse.json({ error: "Échec du rafraîchissement du token Canva. Reconnectez Canva." }, { status: 401 });
    }
  } catch (err) {
    console.error("[Canva Refresh] Exception lors du rafraîchissement :", err.message);
    return NextResponse.json({ error: "Échec du rafraîchissement du token Canva." }, { status: 500 });
  }

  const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  const { error: upsertError } = await admin
    .from("canva_tokens")
    .upsert(
      {
        user_id: user.id,
        access_token: tokenData.access_token,
        // Canva peut ne pas renvoyer de nouveau refresh_token à chaque
        // rafraîchissement — garde l'ancien dans ce cas plutôt que de
        // l'effacer et bloquer le prochain rafraîchissement.
        refresh_token: tokenData.refresh_token || tokenRow.refresh_token,
        expires_at: newExpiresAt,
      },
      { onConflict: "user_id" }
    );

  if (upsertError) {
    console.error("[Canva Refresh] Échec stockage du nouveau token :", upsertError.message);
    return NextResponse.json({ error: "Échec de la mise à jour du token Canva." }, { status: 500 });
  }

  return NextResponse.json({ access_token: tokenData.access_token, expires_at: newExpiresAt });
}
