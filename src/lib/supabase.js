import { createClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./env";

/**
 * Client anonyme "stateless" (pas de gestion de cookies/session) pour les
 * lectures publiques exécutées côté serveur (generateMetadata, sitemap.js,
 * Server Components) : createBrowserClient dépend de document.cookie, absent
 * hors navigateur. Lit les mêmes données que n'importe quel visiteur anonyme
 * — la RLS de Supabase reste la seule barrière, pas ce client.
 */
export function getSupabasePublicClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * createBrowserClient stocke la session dans des cookies au format attendu par
 * createServerClient (utilisé par le middleware), ce qui permet une validation
 * réelle du jeton côté serveur.
 *
 * Une implémentation maison du storage a été retirée ici : elle dupliquait le
 * jeton dans un cookie ET dans localStorage, et son format n'était pas
 * interopérable avec @supabase/ssr.
 */
export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Le bucket "resumes" est privé : la base stocke désormais le CHEMIN du fichier
 * ({user_id}/cvs/...), pas une URL. Cette fonction génère une URL signée valable
 * une heure, utilisable dans un href ou une iframe.
 *
 * Tolère les valeurs héritées : une URL http(s) déjà stockée ou un data:base64
 * est renvoyée telle quelle, sans tentative de signature.
 */
export async function getSignedCvUrl(pathOrUrl, expiresInSeconds = 3600) {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith("http") || pathOrUrl.startsWith("data:")) {
    return pathOrUrl;
  }

  const { data, error } = await supabase.storage
    .from("resumes")
    .createSignedUrl(pathOrUrl, expiresInSeconds);

  if (error) {
    console.error("Impossible de générer l'URL signée du document:", error.message);
    return null;
  }
  return data?.signedUrl || null;
}

/**
 * Fonction universelle de déconnexion propre et sécurisée.
 * Purge la session Supabase, supprime le localStorage/sessionStorage, et redirige avec replacement d'historique.
 */
export async function handleGlobalSignOut() {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.error("SignOut error:", err);
  } finally {
    if (typeof window !== "undefined") {
      localStorage.clear();
      sessionStorage.clear();
      // Empêcher l'utilisation de la flèche "Retour" du navigateur
      window.location.replace("/login");
    }
  }
}
