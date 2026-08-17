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
  "/faq",
];

// Comparaison par segment de chemin plutôt que préfixe brut
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
  // Si aucun cookie Supabase n'est présent, on redirige vers /login
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

  // 6. Contrôle d'accès par fonctionnalité (feature flags, table
  // public.feature_flags) — bloque la navigation DIRECTE vers une route
  // désactivée depuis /admin. Header.jsx ne couvre que le clic sur un lien
  // du menu ; ceci couvre l'URL tapée, un favori, ou tout autre chemin qui
  // ne passe pas par ce clic. Bypass admin d'abord, même sémantique que
  // isFeatureAllowed() côté client (src/lib/featureFlags.js). Fail-open sur
  // toute erreur/timeout Supabase — même philosophie que le reste de ce
  // fichier, jamais un blocage sur panne.
  const userRoleForFlags = userRoleRow?.role || "user";
  if (userRoleForFlags !== "admin") {
    try {
      const flagsPromise = supabase
        .from("feature_flags")
        .select("path, enabled, roles")
        .then((r) => r.data || []);
      const rows = await withTimeout(flagsPromise, 1500);
      const matches = rows.filter((r) => r.path && pathnameMatchesRoute(pathname, r.path));

      if (matches.length > 0) {
        // Statut recruteur : profiles.badges contient 'verified_recruiter',
        // JAMAIS user_roles.role ("recruiter" n'existe pas dans sa
        // contrainte CHECK — voir AuthContext.jsx:196-198). Requête
        // seulement si une des entrées correspondantes distingue vraiment
        // user/recruteur, pour ne pas ajouter un aller-retour Supabase sur
        // chaque page protégée du site.
        let isRecruiter = false;
        if (matches.some((m) => m.roles?.user !== m.roles?.recruiter)) {
          const profilePromise = supabase
            .from("profiles")
            .select("badges")
            .eq("id", user.id)
            .single()
            .then((r) => r.data);
          const profileRow = await withTimeout(profilePromise, 1500).catch(() => null);
          isRecruiter = Array.isArray(profileRow?.badges) && profileRow.badges.includes("verified_recruiter");
        }
        const roleKey = isRecruiter ? "recruiter" : "user";

        // Le plus restrictif gagne quand plusieurs entrées partagent le
        // même chemin physique (ex. /importer-cv, /service ont chacune 2-3
        // entrées distinctes) : si l'admin en désactive UNE seule, la
        // navigation directe est bloquée — choix délibéré, pas la seule
        // lecture possible.
        const blocked = matches.find((m) => !(m.enabled && m.roles?.[roleKey] !== false));
        if (blocked) {
          const url = req.nextUrl.clone();
          url.pathname = "/fonctionnalite-indisponible";
          url.searchParams.set("from", pathname);
          return NextResponse.redirect(url);
        }
      }
    } catch (err) {
      console.warn(
        "[Middleware] Vérification feature flags échouée (accès toléré) :",
        err.message
      );
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
