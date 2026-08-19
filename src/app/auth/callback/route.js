import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";

// Edge (pas nodejs) : cette route n'utilise aucune API Node spécifique
// (contrairement à /api/canva/callback, qui a besoin de crypto) — l'Edge
// Runtime s'exécute au plus proche géographique de la requête au lieu d'une
// seule région fixe, ce qui réduit la latence de l'appel réseau vers
// Supabase (exchangeCodeForSession) pour des utilisateurs loin de la région
// par défaut de la fonction Node.
export const runtime = "edge";

/**
 * GET /auth/callback — point d'échange PKCE pour l'OAuth Google (et tout
 * futur provider), manquant jusqu'ici. Sans cette route, signInWithOAuth()
 * (login/page.js, register/page.js) pointait "redirectTo" directement sur
 * la page de destination protégée (ex. /profil) : le navigateur y arrivait
 * avec ?code=... AVANT que la session existe, le middleware (src/proxy.js)
 * le renvoyait alors vers /login (aucun cookie de session encore posé), où
 * le SDK client détectait enfin le code et l'échangeait — d'où le double
 * aller-retour observé avant d'atteindre la plateforme.
 *
 * Ici, l'échange se fait CÔTÉ SERVEUR avant toute redirection : le cookie
 * de session est déjà posé quand le navigateur atteint enfin la page de
 * destination, donc le middleware la laisse passer dès le premier essai.
 */
export async function GET(req) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") || "/";
  // Jamais une redirection ouverte : uniquement un chemin interne commençant
  // par "/" et pas "//" (qui serait interprété comme une URL externe par le navigateur).
  const safeNext = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const res = NextResponse.redirect(`${origin}${safeNext}`);

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookiesToSet) =>
        cookiesToSet.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options)
        ),
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[Auth Callback] Échec de l'échange du code OAuth :", error.message);
    return NextResponse.redirect(`${origin}/login?oauth_error=1`);
  }

  return res;
}
