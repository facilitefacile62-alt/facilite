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
  // Échange du code OAuth (voir src/app/auth/callback/route.js) : atteint
  // AVANT qu'un cookie de session existe, par construction — doit rester
  // public pour ne pas se bloquer lui-même.
  "/auth/callback",
  // Pages légales statiques, même nature que /faq (texte pur, aucune
  // personnalisation) — trouvées le 2026-08-21 en vérifiant robots.txt
  // contre le comportement réel : toutes redirigeaient vers /login pour un
  // visiteur anonyme (donc pour Google) malgré leur présence dans
  // sitemap.js, qui les annonce comme indexables depuis le début sans
  // qu'elles l'aient jamais été.
  "/conditions",
  "/confidentialite",
  "/politique-de-confidentialite",
  "/conditions-utilisation",
  // Demande de suppression de compte. Google Play exige que cette URL soit
  // atteignable SANS installer l'application et SANS être connecté : la
  // laisser hors de cette liste la ferait rediriger vers /login pour un
  // visiteur anonyme, donc pour l'examinateur, et la fiche Data Safety
  // serait rejetée.
  "/suppression-compte",
];

// Routes visibles SANS connexion (pour Googlebot et les visiteurs anonymes)
// mais qui restent soumises au contrôle par fonctionnalité (section 6
// ci-dessous) — contrairement à PUBLIC_ROUTES qui court-circuite tout,
// contrôle par fonctionnalité inclus. Un visiteur anonyme y est résolu avec
// le rôle "visitor" (jamais "user" par défaut, résolution de rôle qui
// serait incorrecte).
const PUBLIC_BROWSABLE_ROUTES = [
  // Liste et détail des offres : doivent être crawlables par Googlebot pour
  // que le JSON-LD JobPosting (src/app/offres/[id]/page.js) et le sitemap
  // (src/app/sitemap.js) aient un effet réel — sinon le travail SEO reste
  // invisible pour Google quelle que soit sa qualité. Postuler reste
  // protégé séparément par OffreApplySection, pas par ce mur de connexion.
  // Ne couvre que /offres et /offres/[id] (seules pages sous ce préfixe) —
  // la publication d'offres vit sous /recruteur, non touchée.
  "/offres",
  // Vues filtrées sur listing_type (même composant qu'/offres, même
  // raisonnement SEO/anonyme) — sans cette entrée, ces nouvelles routes
  // seraient bloquées par défaut (refus par défaut, voir doc en tête de
  // fichier) et rediraient un visiteur anonyme vers /login.
  "/concours",
  "/formations",
  // Même raisonnement, trouvé le 2026-08-21 en vérifiant que le
  // generateMetadata ajouté à ces deux pages avait un effet réel : profil
  // public candidat et vitrine recruteur sont conçus pour être partagés
  // (contrôle déjà fait côté candidat par profiles.is_public, filtré par
  // get_profils_publics() — ce mur de connexion était redondant avec ce
  // contrôle, pas une protection supplémentaire voulue) et référencés.
  // Postuler depuis /recruteurs/[id] reste protégé séparément par
  // ApplyModal, pas par ce mur.
  "/in",
  "/recruteurs",
  // Même trouvaille que ci-dessus (2026-08-21) : pages produit/marketing
  // annoncées indexables par sitemap.js mais en réalité bloquées par ce
  // mur. PUBLIC_BROWSABLE plutôt que PUBLIC_ROUTES (contrairement aux
  // pages légales ci-dessus) : ce sont des pages produit consultées aussi
  // bien par des visiteurs anonymes que des utilisateurs connectés,
  // potentiellement sensibles au contrôle par fonctionnalité (/service
  // l'utilise déjà) — comportement inchangé pour un visiteur déjà
  // authentifié, seul l'accès anonyme change.
  "/service",
  "/modeles",
  "/fonctionnalites",
  "/recrutement-spontane",
  "/recrutement-journalier",
  "/boite-a-idees",
  "/aide-candidature",
  // Même trouvaille que les entrées ci-dessus, trouvée le 2026-08-22 :
  // aucune route de recherche visible pour un visiteur anonyme (barre du
  // header comme page dédiée) ne doit forcer une redirection /login avant
  // même d'avoir exécuté la recherche — un visiteur qui n'a pas encore de
  // compte doit pouvoir chercher une offre avant de décider de s'inscrire.
  "/recherche",
  // Trouvé le 02/09/2026 en testant /etablissements dans un vrai navigateur,
  // sans session : /marketplace redirigeait aussi vers /login pour un
  // visiteur anonyme, alors que son propre drapeau (nav_marketplace) déclare
  // roles.visitor = true et que l'onglet Acheteur ne demande jamais de
  // connexion. Le mur d'authentification annulait ce choix depuis toujours —
  // page absente de cette liste, refus par défaut. PUBLIC_BROWSABLE et non
  // PUBLIC_ROUTES : le contrôle par fonctionnalité (section 6) doit rester
  // appliqué, c'est lui qui respecte le drapeau nav_marketplace.
  "/marketplace",
  // La mienne : trouver une pharmacie de garde ne doit pas attendre une
  // création de compte, surtout à l'heure où on en a besoin. Sans cette
  // entrée, /etablissements héritait du refus par défaut comme toute
  // nouvelle route — c'est le même oubli que ci-dessus, découvert dans le
  // même test.
  "/etablissements",
];

// Comparaison par segment de chemin plutôt que préfixe brut
function pathnameMatchesRoute(pathname, route) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

// Certaines entrées feature_flags stockent un chemin AVEC query string (ex.
// nav_plus_formation: "/offres?q=Formation") — req.nextUrl.pathname ne
// contient jamais de query string, donc pathnameMatchesRoute seule ne peut
// jamais les faire correspondre : une visite directe de l'URL contournait
// le blocage (trouvé le 2026-08-17, un utilisateur visitant directement
// /offres?q=Formation passait alors que le clic depuis le menu était bien
// bloqué). Comparaison par pathname + valeur de(s) paramètre(s) de la query
// stockée, insensible à la casse — pas une égalité de chaîne stricte, pour
// qu'un ?q=formation (casse différente) ou un paramètre supplémentaire ne
// suffise pas à contourner le blocage.
function matchesFlagPath(nextUrl, flagPath) {
  if (!flagPath) return false;
  const [flagPathname, flagQuery] = flagPath.split("?");
  if (!flagQuery) return pathnameMatchesRoute(nextUrl.pathname, flagPath);
  if (nextUrl.pathname !== flagPathname) return false;
  const flagParams = new URLSearchParams(flagQuery);
  for (const [key, value] of flagParams.entries()) {
    if ((nextUrl.searchParams.get(key) || "").toLowerCase() !== value.toLowerCase()) return false;
  }
  return true;
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

  // Route "browsable publiquement" (ex. /offres) : pas de mur de connexion,
  // mais le contrôle par fonctionnalité (section 6) reste appliqué plus bas
  // avec le rôle "visitor" si aucune session n'est trouvée.
  const isPublicBrowsable = PUBLIC_BROWSABLE_ROUTES.some((route) =>
    pathnameMatchesRoute(pathname, route)
  );

  // 2. Vérification rapide des cookies pour les utilisateurs anonymes
  // Si aucun cookie Supabase n'est présent, on redirige vers /login
  const cookies = req.cookies.getAll();
  const hasSupabaseCookie = cookies.some(
    (c) => c.name.startsWith("sb-") || c.name.includes("auth-token")
  );

  if (!hasSupabaseCookie && !isPublicBrowsable) {
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

  if (!user && !isPublicBrowsable) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // 4. Récupération du rôle et du statut avec timeout résilient — inutile
  // pour un visiteur anonyme sur une route browsable, il n'a pas de ligne
  // user_roles à lire.
  let userRoleRow = null;
  if (user) {
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
  const userRoleForFlags = userRoleRow?.role || (user ? "user" : "visitor");
  if (userRoleForFlags !== "admin") {
    try {
      const flagsPromise = supabase
        .from("feature_flags")
        .select("id, path, enabled, roles")
        .then((r) => r.data || []);
      const rows = await withTimeout(flagsPromise, 1500);
      const matches = rows.filter(
        (r) =>
          r.path &&
          !r.id.startsWith("feat_offres_") &&
          r.id !== "feat_matching_ia_postuler" &&
          r.id !== "feat_diagnostic_cv" &&
          r.id !== "feat_card_pret_candidature" &&
          r.id !== "feat_voice_assistant" &&
          matchesFlagPath(req.nextUrl, r.path)
      );

      if (matches.length > 0) {
        // Statut recruteur : profiles.badges contient 'verified_recruiter',
        // JAMAIS user_roles.role ("recruiter" n'existe pas dans sa
        // contrainte CHECK — voir AuthContext.jsx:196-198). Requête
        // seulement si une des entrées correspondantes distingue vraiment
        // user/recruteur, pour ne pas ajouter un aller-retour Supabase sur
        // chaque page protégée du site. Un visiteur anonyme (pas de user)
        // n'a pas de profil à interroger — reste "visitor" directement.
        let isRecruiter = false;
        if (user && matches.some((m) => m.roles?.user !== m.roles?.recruiter)) {
          const profilePromise = supabase
            .from("profiles")
            .select("badges")
            .eq("id", user.id)
            .single()
            .then((r) => r.data);
          const profileRow = await withTimeout(profilePromise, 1500).catch(() => null);
          isRecruiter = Array.isArray(profileRow?.badges) && profileRow.badges.includes("verified_recruiter");
        }
        const roleKey = !user ? "visitor" : isRecruiter ? "recruiter" : "user";

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
    // robots.txt/sitemap.xml.
    //
    // Ajouts du 2026-08-24, trois fichiers qui DOIVENT répondre en 200 sans
    // session — mesuré avant correction : /.well-known/assetlinks.json
    // renvoyait « 307 -> /login?redirect=%2F.well-known%2Fassetlinks.json ».
    //   * .well-known/ : Google vérifie assetlinks.json SANS cookie pour
    //     valider une Trusted Web Activity. Une redirection = vérification
    //     échouée = barre d'URL affichée dans l'app Android.
    //   * sw.js : un script de service worker qui redirige ne peut pas être
    //     enregistré du tout — le mode hors ligne ne démarrerait jamais.
    //   * hors-ligne.html : page de repli servie par le service worker,
    //     précisément quand il n'y a pas de réseau pour joindre /login.
    "/((?!api/|_next/static|_next/image|favicon\\.ico|manifest\\.json|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|\\.well-known/|sw\\.js|hors-ligne\\.html|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?)$).*)",
  ],
};
