import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";

// nodejs (et plus edge) depuis le 2026-08-28.
//
// L'Edge Runtime avait été choisi pour la latence géographique. Mais il
// impose une limite d'exécution courte et non ajustable : quand l'échange
// PKCE dépassait cette limite, Vercel renvoyait une page blanche
// 504 FUNCTION_INVOCATION_TIMEOUT, sans même un lien pour réessayer.
//
// Constat de terrain qui a tranché : après la mise en place de la borne à
// 8 s, l'utilisateur a vu s'afficher « La connexion Google n'a pas abouti à
// temps » — donc l'échange prend RÉELLEMENT plus de 8 secondes, alors
// qu'un code invalide, lui, revient en 0,3 s. Ce n'est pas un blocage
// infini, c'est un échange lent : le couper court garantissait l'échec.
//
// En runtime nodejs on peut déclarer maxDuration et donner à l'échange un
// budget réaliste. C'est aussi le runtime de toutes les autres routes
// d'authentification de l'application (/api/auth/*), qui n'ont jamais
// présenté ce symptôme.
export const runtime = "nodejs";

// 30 s : très au-dessus de l'échange normal (0,3-0,4 s mesuré), et
// au-dessus du plafond que l'Edge Runtime imposait silencieusement.
export const maxDuration = 30;

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

  // INCIDENT DE PRODUCTION 2026-08-28 : 504 FUNCTION_INVOCATION_TIMEOUT sur
  // cette route précise (GET /auth/callback?code=…&next=%2F, requêtes
  // lhr1::zdfdx-1787908620542 puis lhr1::5j6fm-1787910021929). L'échange
  // PKCE était le SEUL await de la fonction et n'était borné par rien :
  // quand Supabase ne répondait pas, la fonction Edge allait jusqu'à sa
  // limite et Vercel renvoyait une page blanche 504 — un cul-de-sac, sans
  // même un lien pour réessayer.
  //
  // Toutes les autres portes d'entrée de l'application bornent déjà leurs
  // appels réseau (withTimeout(…, 1500) dans src/proxy.js) ; celle-ci était
  // la seule à ne pas le faire, sur le chemin le plus critique qui soit.
  //
  // 20 s, sous les 30 s de maxDuration pour garder la main et répondre
  // proprement. La borne précédente à 8 s coupait un échange qui, mesuré
  // sur le terrain, met parfois plus longtemps : elle transformait une
  // lenteur en échec certain. Ici on laisse le temps d'aboutir, et on ne
  // renonce que si c'est vraiment perdu.
  const DELAI_MAX_ECHANGE_MS = 20000;
  const debut = Date.now();

  let error = null;
  try {
    const echange = supabase.auth.exchangeCodeForSession(code);
    const resultat = await Promise.race([
      echange,
      new Promise((resolve) => setTimeout(() => resolve({ __timeout: true }), DELAI_MAX_ECHANGE_MS)),
    ]);

    if (resultat?.__timeout) {
      console.error(
        `[Auth Callback] Échange PKCE non abouti après ${DELAI_MAX_ECHANGE_MS}ms — redirection au lieu d'un 504.`
      );
      return NextResponse.redirect(`${origin}/login?oauth_error=timeout`);
    }
    error = resultat?.error || null;
  } catch (err) {
    console.error("[Auth Callback] Exception pendant l'échange OAuth :", err?.message);
    return NextResponse.redirect(`${origin}/login?oauth_error=1`);
  }

  if (error) {
    console.error(
      `[Auth Callback] Échec de l'échange du code OAuth (${Date.now() - debut}ms) :`,
      error.message
    );
    return NextResponse.redirect(`${origin}/login?oauth_error=1`);
  }

  return res;
}
