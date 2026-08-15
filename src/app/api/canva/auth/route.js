import { NextResponse } from "next/server";
import crypto from "crypto";
import { getUserFromCookies } from "@/lib/apiAuth";

export const runtime = "nodejs";

// Signe le state anti-CSRF avec CANVA_CLIENT_SECRET (déjà un secret privé
// serveur uniquement, scopé à ce flux Canva précis) plutôt que d'introduire
// une nouvelle variable d'environnement dédiée.
function signState(state) {
  return crypto.createHmac("sha256", process.env.CANVA_CLIENT_SECRET).update(state).digest("hex");
}

/**
 * GET /api/canva/auth — initie le flux OAuth Canva.
 *
 * Atteint par une navigation navigateur directe (clic sur "Connecter
 * Canva"), jamais par fetch() : requireUser() (Bearer) ne peut donc pas
 * s'appliquer ici — aucun en-tête Authorization n'est envoyé lors d'une
 * navigation. getUserFromCookies() est la variante prévue pour exactement
 * ce cas (voir son commentaire dans apiAuth.js, qui cite explicitement
 * "une redirection OAuth tierce").
 */
export async function GET(req) {
  const user = await getUserFromCookies();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/creer-cv", req.url));
  }

  const state = crypto.randomUUID();
  const signature = signState(state);

  const authorizeUrl = new URL("https://www.canva.com/api/oauth/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", process.env.CANVA_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", process.env.CANVA_REDIRECT_URI);
  authorizeUrl.searchParams.set("scope", "design:content:read design:content:write");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl.toString());
  response.cookies.set("canva_oauth_state", `${state}.${signature}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}
