import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";
import { roleHomePath } from "@/lib/roles";

/**
 * Protection des routes en REFUS PAR DÉFAUT.
 *
 * Une liste noire de routes protégées oblige à penser à chaque nouvelle page :
 * la moindre omission crée un trou silencieux. Ici tout est intercepté sauf ce
 * qui figure explicitement dans PUBLIC_ROUTES, donc une nouvelle page est
 * protégée d'office.
 */

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/in", // profils publics
  "/service",
  "/offres",
  "/recruteurs", // vitrines publiques recruteur (/recruteurs/[id])
];

// Comparaison par segment de chemin plutôt que préfixe brut : pathname.startsWith("/recruteur")
// matche aussi "/recruteurs/xxx" (vitrine publique), pas seulement "/recruteur"
// (dashboard recruteur) — un vrai bug trouvé via le test E2E, qui redirigeait
// n'importe quel candidat hors des vitrines publiques.
function pathnameMatchesRoute(pathname, route) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function estRoutePublique(pathname) {
  return PUBLIC_ROUTES.some((route) => pathnameMatchesRoute(pathname, route));
}

export async function middleware(req) {
  const res = NextResponse.next();

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookiesToSet) =>
        cookiesToSet.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options)
        ),
    },
  });

  // getUser() valide la signature et l'expiration du JWT auprès de Supabase.
  // getSession() se contenterait de lire le jeton local, sans rien prouver.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = req.nextUrl;

  if (!estRoutePublique(pathname) && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    // Permet de ramener l'utilisateur là où il allait, une fois connecté
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Vérification des autorisations selon le rôle pour les routes restreintes.
  //
  // Source de vérité : UNIQUEMENT public.profiles.role, jamais
  // user.user_metadata.role. user_metadata (raw_user_meta_data) est fourni
  // par le client au signup (options.data) — un attaquant peut y écrire
  // n'importe quoi ("role": "admin") et ce claim finit dans son propre JWT.
  // Le lire ici pour une décision d'autorisation aurait permis à quiconque
  // de s'auto-attribuer l'accès à /admin sans jamais toucher à la base.
  if (
    user &&
    (pathnameMatchesRoute(pathname, "/admin") ||
      pathnameMatchesRoute(pathname, "/recruteur") ||
      pathnameMatchesRoute(pathname, "/candidat"))
  ) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const userRole = profile?.role || "candidat";
    const requiredRole = pathnameMatchesRoute(pathname, "/admin")
      ? "admin"
      : pathnameMatchesRoute(pathname, "/recruteur")
      ? "recruteur"
      : "candidat";

    if (userRole !== requiredRole && userRole !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname = roleHomePath(userRole);
      return NextResponse.redirect(url);
    }
  }

  return res;
}

export const config = {
  matcher: [
    // Tout sauf les assets statiques et les routes /api (celles-ci valident
    // elles-mêmes le jeton Bearer via requireUser dans lib/apiAuth.js).
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?)$).*)",
  ],
};
