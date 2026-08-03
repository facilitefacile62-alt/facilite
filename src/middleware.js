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
  // Source de vérité : UNIQUEMENT public.user_roles.role (jamais
  // user.user_metadata.role, ni l'ancienne public.profiles.role — supprimée
  // par le chantier RBAC, 20260802050000). user_metadata (raw_user_meta_data)
  // est fourni par le client au signup (options.data) — un attaquant peut y
  // écrire n'importe quoi ("role": "admin") et ce claim finit dans son
  // propre JWT. Le lire ici pour une décision d'autorisation aurait permis
  // à quiconque de s'auto-attribuer l'accès à /admin sans jamais toucher à
  // la base.
  if (
    user &&
    (pathnameMatchesRoute(pathname, "/admin") ||
      pathnameMatchesRoute(pathname, "/recruteur") ||
      pathnameMatchesRoute(pathname, "/candidat"))
  ) {
    const { data: userRoleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const userRole = userRoleRow?.role || "user";

    // Correctif escalade de privilèges (2026-08-02) : badges ne doit JAMAIS
    // décider d'une autorisation, y compris ici — un ancien détour lisait
    // le badge cosmétique 'official_staff' pour accorder /admin, une
    // deuxième source de vérité pour les mêmes droits que role='publisher'.
    // role (public.user_roles) est désormais la SEULE source lue pour
    // toute décision d'accès, sans exception.
    // /admin : 'admin' et 'publisher' uniquement.
    // /recruteur et /candidat : 'user' et 'admin' — 'publisher' (personnel
    // interne) en est exclu, son périmètre reste /admin.
    const isAuthorized = pathnameMatchesRoute(pathname, "/admin")
      ? userRole === "admin" || userRole === "publisher"
      : userRole === "user" || userRole === "admin";

    if (!isAuthorized) {
      const url = req.nextUrl.clone();
      url.pathname = roleHomePath(userRole);
      return NextResponse.redirect(url);
    }

    // Étape D (2026-08-03) : verified_recruiter gate désormais tout l'espace
    // /recruteur au niveau RLS (20260803110000_badge_gate_espace_recruteur.sql)
    // et côté page (l'écran d'accréditation NINEA/RCCM remplace le tableau
    // de bord tant que le badge n'est pas accordé). Volontairement PAS de
    // redirection ici pour un 'user' non badgé : /recruteur est aussi le
    // seul endroit où soumettre la demande d'accréditation — rediriger
    // ailleurs empêcherait justement d'y accéder. Le rôle reste vérifié
    // ci-dessus (user/admin, pas publisher) ; le badge est vérifié à la
    // couche donnée (seule couche où la décision "encore, ou pas encore ?"
    // change sans rechargement de page).
  }

  return res;
}

export const config = {
  matcher: [
    // Tout sauf les assets statiques, les routes /api (celles-ci valident
    // elles-mêmes le jeton Bearer via requireUser dans lib/apiAuth.js), et
    // robots.txt/sitemap.xml : sans cette exclusion, un crawler anonyme était
    // redirigé vers /login et ne voyait jamais le vrai contenu généré par
    // src/app/robots.js et src/app/sitemap.js.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?)$).*)",
  ],
};
