import { NextResponse } from "next/server";
import crypto from "crypto";
import { getUserFromCookies } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function signState(state) {
  return crypto.createHmac("sha256", process.env.CANVA_CLIENT_SECRET).update(state).digest("hex");
}

function timingSafeEqualStrings(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * GET /api/canva/callback — reçu directement depuis Canva (redirection
 * navigateur, pas fetch()) : même contrainte que /api/canva/auth,
 * getUserFromCookies() plutôt que requireUser().
 */
export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");

  const cookieValue = req.cookies.get("canva_oauth_state")?.value || "";

  // Toujours supprimer le cookie state après lecture, succès ou échec — un
  // state à usage unique qui traîne au-delà de cette vérification n'a plus
  // aucune utilité et ne doit jamais être rejouable.
  const clearStateCookie = (response) => {
    response.cookies.set("canva_oauth_state", "", { maxAge: 0, path: "/" });
    return response;
  };

  const errorRedirect = (reason) =>
    clearStateCookie(NextResponse.redirect(new URL(`/creer-cv?canva=error&reason=${reason}`, req.url)));

  if (!code || !returnedState) return errorRedirect("missing_params");
  if (!cookieValue) return errorRedirect("missing_state_cookie");

  const dotIndex = cookieValue.lastIndexOf(".");
  if (dotIndex === -1) return errorRedirect("malformed_state_cookie");
  const cookieState = cookieValue.slice(0, dotIndex);
  const cookieSignature = cookieValue.slice(dotIndex + 1);

  const expectedSignature = signState(cookieState);
  if (!timingSafeEqualStrings(cookieSignature, expectedSignature)) return errorRedirect("invalid_state_signature");
  if (!timingSafeEqualStrings(cookieState, returnedState)) return errorRedirect("state_mismatch");

  const user = await getUserFromCookies();
  if (!user) return errorRedirect("not_authenticated");

  let tokenData;
  try {
    const tokenResponse = await fetch("https://api.canva.com/rest/v1/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: process.env.CANVA_CLIENT_ID,
        client_secret: process.env.CANVA_CLIENT_SECRET,
        redirect_uri: process.env.CANVA_REDIRECT_URI,
      }),
      cache: "no-store",
    });

    tokenData = await tokenResponse.json().catch(() => null);

    if (!tokenResponse.ok || !tokenData?.access_token) {
      console.error("[Canva OAuth] Échange code->token échoué :", tokenResponse.status, tokenData);
      return errorRedirect("token_exchange_failed");
    }
  } catch (err) {
    console.error("[Canva OAuth] Exception lors de l'échange code->token :", err.message);
    return errorRedirect("token_exchange_exception");
  }

  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  const admin = getSupabaseAdmin();
  const { error: upsertError } = await admin
    .from("canva_tokens")
    .upsert(
      {
        user_id: user.id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        expires_at: expiresAt,
      },
      { onConflict: "user_id" }
    );

  if (upsertError) {
    console.error("[Canva OAuth] Échec stockage du token :", upsertError.message);
    return errorRedirect("token_storage_failed");
  }

  return clearStateCookie(NextResponse.redirect(new URL("/creer-cv?canva=connected", req.url)));
}
