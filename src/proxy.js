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
  "/recrutement-spontane",
  "/recrutement-journalier",
  "/modeles", // vitrine publique des modèles de CV — le choix d'un modèle
              // reste protégé séparément (session requise avant /creer-cv,
              // voir src/app/modeles/page.jsx). L'intégration Canva OAuth
              // (/api/canva/*) a été retirée le 2026-08-14, jamais
              // atteignable depuis l'UI (aucun composant ne la déclenchait) :
              // le générateur interne /creer-cv l'a remplacée.
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

// Helper pour exécuter une promesse avec un temps limite (timeout) en ms
async function withTimeout(promise, timeoutMs = 1500) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("TIMEOUT"));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

export default async function proxy(req) {
  const { pathname } = req.nextUrl;

  // 1. Si la route est publique, court-circuit immédiat sans aucun appel réseau
  if (estRoutePublique(pathname)) {
    return NextResponse.next();
  }

  // 2. Vérification rapide des cookies pour les utilisateurs anonymes
  // Si aucun cookie Supabase n'est présent, on évite tout appel Supabase réseau
  const cookies = req.cookies.getAll();
  const hasSupabaseCookie = cookies.some(
    (c) => c.name.startsWith("sb-") || c.name.includes("auth-token")
  );

  if (!hasSupabaseCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  let user = null;
  let supabase = null;

  // 3. Récupération de l'utilisateur avec timeout résilient
  try {
    supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) =>
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          ),
      },
    });

    const userPromise = supabase.auth.getUser().then((r) => r.data.user);
    user = await withTimeout(userPromise, 1500);
  } catch (err) {
    console.warn(
      "[Middleware] Timeout ou échec de récupération Supabase user (accès toléré) :",
      err.message
    );
    // En cas d'erreur réseau / timeout, on laisse passer la requête. 
    // Les règles RLS au niveau de la base de données sécuriseront l'accès.
    return res;
  }

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // 4. Récupération du rôle et du statut avec timeout résilient
  let userRoleRow = null;
  try {
    const rolePromise = supabase
      .from("user_roles")
      .select("role, status, suspended_by")
      .eq("user_id", user.id)
      .single()
      .then((r) => r.data);

    userRoleRow = await withTimeout(rolePromise, 1500);
  } catch (err) {
    console.warn(
      "[Middleware] Timeout ou échec de récupération du rôle Supabase (accès toléré) :",
      err.message
    );
    return res;
  }

  // Un compte suspendu perd l'accès à toute page protégée immédiatement —
  // sauf s'il s'agit d'une auto-désactivation (suspended_by NULL, section
  // "Désactiver le compte" du profil) : dans ce cas la reconnexion elle-même
  // réactive le compte au lieu de le déconnecter à nouveau. Une suspension
  // admin (suspended_by rempli) garde le comportement existant, jamais levée
  // automatiquement.
  if (userRoleRow?.status === "suspended") {
    if (userRoleRow.suspended_by === null) {
      try {
        await withTimeout(supabase.rpc("reactivate_own_account_if_self_suspended"), 1500);
      } catch (e) {
        console.error("[Middleware] Échec réactivation auto-désactivation :", e.message);
      }
      return res;
    }

    try {
      await withTimeout(supabase.auth.signOut(), 1000);
    } catch (e) {
      console.error("[Middleware] Échec signOut pour compte suspendu :", e.message);
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("suspended", "true");
    return NextResponse.redirect(url);
  }

  // 5. Autorisation d'accès par espaces
  if (
    pathnameMatchesRoute(pathname, "/admin") ||
    pathnameMatchesRoute(pathname, "/recruteur") ||
    pathnameMatchesRoute(pathname, "/candidat")
  ) {
    const userRole = userRoleRow?.role || "user";
    const isAuthorized = pathnameMatchesRoute(pathname, "/admin")
      ? userRole === "admin" || userRole === "publisher"
      : userRole === "user" || userRole === "admin";

    if (!isAuthorized) {
      const url = req.nextUrl.clone();
      url.pathname = roleHomePath(userRole);
      return NextResponse.redirect(url);
    }
  }

  return res;
}

export const config = {
  matcher: [
    // Tout sauf les assets statiques, les routes /api (celles-ci valident
    // elles-mêmes le jeton Bearer via requireUser dans lib/apiAuth.js), et
    // robots.txt/sitemap.xml
    "/((?!api/|_next/static|_next/image|favicon\\.ico|manifest\\.json|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?)$).*)",
  ],
};
