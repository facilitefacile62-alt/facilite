import { NextResponse } from "next/server";
import crypto from "crypto";
import { getUserFromCookies } from "@/lib/apiAuth";

export const runtime = "nodejs";

// Signe une valeur de cookie (state anti-CSRF, PKCE verifier) avec
// CANVA_CLIENT_SECRET (déjà un secret privé serveur uniquement, scopé à ce
// flux Canva précis) plutôt que d'introduire une nouvelle variable
// d'environnement dédiée.
function signValue(value) {
  return crypto.createHmac("sha256", process.env.CANVA_CLIENT_SECRET).update(value).digest("hex");
}

/**
 * GET /api/canva/auth — initie le flux OAuth Canva (PKCE obligatoire pour
 * ce client — confirmé en conditions réelles : Canva rejette l'échange de
 * code avec "'code_verifier' must not be null" sans ça).
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
  const stateSignature = signValue(state);

  // code_verifier : 32 octets aléatoires en base64url (43 caractères, dans
  // la plage 43-128 exigée par PKCE). Buffer#toString("base64url") de
  // Node.js n'ajoute jamais de padding — conforme à RFC 7636 sans étape
  // supplémentaire.
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeVerifierSignature = signValue(codeVerifier);

  // code_challenge = BASE64URL(SHA256(ASCII(code_verifier))) — hash de la
  // CHAÎNE code_verifier elle-même (ses octets UTF-8), pas des octets
  // aléatoires d'origine.
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");

  const authorizeUrl = new URL("https://www.canva.com/api/oauth/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", process.env.CANVA_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", process.env.CANVA_REDIRECT_URI);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", codeChallenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  // Scopes confirmés depuis la documentation officielle Canva
  // (canva.dev/docs/connect/appendix/scopes/ — l'URL initialement donnée,
  // .../authentication/scopes/, renvoyait 404 ; celle-ci est la bonne).
  // Aucun préfixe "canva:" — vérifié sur la page elle-même.
  const scopes = [
    "design:content:read",
    "design:content:write",
    "design:meta:read",
    "brandtemplate:content:read",
    "brandtemplate:content:write",
    "brandtemplate:meta:read",
  ].join(" ");
  const finalAuthorizeUrl = `${authorizeUrl.toString()}&scope=${encodeURIComponent(scopes)}`;

  const response = NextResponse.redirect(finalAuthorizeUrl);
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  };
  response.cookies.set("canva_oauth_state", `${state}.${stateSignature}`, cookieOptions);
  response.cookies.set("canva_pkce_verifier", `${codeVerifier}.${codeVerifierSignature}`, cookieOptions);

  return response;
}
