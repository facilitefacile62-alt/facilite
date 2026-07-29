import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";

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
];

function estRoutePublique(pathname) {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
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

  // Verification des autorisations selon le rôle pour les routes restreintes
  if (user) {
    let userRole = user.user_metadata?.role || "candidat";

    // Si le rôle n'est pas dans les metadonnées, interroger profiles
    if (!user.user_metadata?.role) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (profile?.role) {
          userRole = profile.role;
        }
      } catch (err) {
        console.warn("Middleware profile role fetch error:", err);
      }
    }

    // Protection des routes /admin/* (réservé aux admins)
    if (pathname.startsWith("/admin") && userRole !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    // Protection des routes /recruteur/* (réservé aux recruteurs et admins)
    if (pathname.startsWith("/recruteur") && userRole !== "recruteur" && userRole !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
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
