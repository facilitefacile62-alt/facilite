import { NextResponse } from "next/server";
import crypto from "crypto";
import { getUserFromCookies } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function signValue(value) {
  return crypto.createHmac("sha256", process.env.CANVA_CLIENT_SECRET).update(value).digest("hex");
}

function timingSafeEqualStrings(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Vérifie un cookie signé "${value}.${hmac}" et renvoie value, ou null si
// absent/malformé/signature invalide.
function readSignedCookie(req, name) {
  const raw = req.cookies.get(name)?.value || "";
  if (!raw) return null;
  const dotIndex = raw.lastIndexOf(".");
  if (dotIndex === -1) return null;
  const value = raw.slice(0, dotIndex);
  const signature = raw.slice(dotIndex + 1);
  if (!timingSafeEqualStrings(signature, signValue(value))) return null;
  return value;
}

/**
 * GET /api/canva/callback — reçu directement depuis Canva (redirection
 * navigateur, pas fetch()) : même contrainte que /api/canva/auth,
 * getUserFromCookies() plutôt que requireUser().
 *
 * PKCE obligatoire pour ce client Canva (confirmé en conditions réelles :
 * "'code_verifier' must not be null" sans ça) — canva_pkce_verifier est lu
 * ici et ajouté à l'échange de code, en plus de canva_oauth_state.
 */
export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");

  // Toujours supprimer les deux cookies après lecture, succès ou échec —
  // un state/verifier à usage unique qui traîne au-delà de cette
  // vérification n'a plus aucune utilité et ne doit jamais être rejouable.
  const clearOauthCookies = (response) => {
    response.cookies.set("canva_oauth_state", "", { maxAge: 0, path: "/" });
    response.cookies.set("canva_pkce_verifier", "", { maxAge: 0, path: "/" });
    return response;
  };

  const errorRedirect = (reason) =>
    clearOauthCookies(NextResponse.redirect(new URL(`/creer-cv?canva=error&reason=${reason}`, req.url)));

  if (!code || !returnedState) return errorRedirect("missing_params");

  const cookieState = readSignedCookie(req, "canva_oauth_state");
  if (!cookieState) return errorRedirect("missing_or_invalid_state_cookie");
  if (!timingSafeEqualStrings(cookieState, returnedState)) return errorRedirect("state_mismatch");

  const codeVerifier = readSignedCookie(req, "canva_pkce_verifier");
  if (!codeVerifier) return errorRedirect("missing_pkce_verifier");

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
        code_verifier: codeVerifier,
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

  return clearOauthCookies(NextResponse.redirect(new URL("/creer-cv?canva=connected", req.url)));
}
