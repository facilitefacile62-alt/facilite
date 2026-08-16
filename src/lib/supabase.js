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
  if (!pathOrUrl || typeof pathOrUrl !== "string") return null;
  const cleanPath = pathOrUrl.trim();
  if (!cleanPath) return null;
  if (cleanPath.startsWith("http") || cleanPath.startsWith("data:") || cleanPath.startsWith("blob:")) {
    return cleanPath;
  }

  try {
    const { data, error } = await supabase.storage
      .from("resumes")
      .createSignedUrl(cleanPath, expiresInSeconds);

    if (error) {
      return null;
    }
    return data?.signedUrl || null;
  } catch (err) {
    return null;
  }
}

/**
 * Résout un avatar_url/cover_url de `profiles` en URL affichable.
 *
 * Trois cas, jamais de tentative de signature en dehors du troisième :
 * - data:image/... (résidu base64 d'avant la migration Storage, ou photo
 *   Google OAuth encodée) : renvoyé tel quel, cas de sécurité explicite.
 * - chemin commençant par "/" (assets statiques par défaut /logo.jpeg,
 *   /stellar-cover.png) ou URL http(s) déjà complète (valeur héritée) :
 *   renvoyé tel quel.
 * - chemin de bucket Storage ({user_id}/avatar.jpg ou .../cover.jpg) :
 *   résolu en URL signée temporaire (RLS : propriétaire ou admin uniquement,
 *   voir 20260813180000_avatars_covers_policies.sql).
 */
async function resolveProfilePhotoUrl(bucket, pathOrUrl, expiresInSeconds) {
  if (!pathOrUrl || typeof pathOrUrl !== "string") return null;
  const cleanPath = pathOrUrl.trim();
  if (!cleanPath) return null;
  if (cleanPath.startsWith("data:image") || cleanPath.startsWith("http") || cleanPath.startsWith("/") || cleanPath.startsWith("blob:")) {
    return cleanPath;
  }

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(cleanPath, expiresInSeconds);
    if (error) {
      return null;
    }
    return data?.signedUrl || null;
  } catch (err) {
    return null;
  }
}

export async function getSignedAvatarUrl(pathOrUrl, expiresInSeconds = 3600) {
  return resolveProfilePhotoUrl("avatars", pathOrUrl, expiresInSeconds);
}

export async function getSignedCoverUrl(pathOrUrl, expiresInSeconds = 3600) {
  return resolveProfilePhotoUrl("covers", pathOrUrl, expiresInSeconds);
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

/**
 * Exécute une requête Supabase avec un mécanisme de retry (backoff exponentiel)
 * en cas d'erreur 500 ou d'erreur réseau temporaire.
 * 
 * @param {Function} queryFn - Fonction renvoyant la promesse de la requête Supabase
 * @param {number} maxRetries - Nombre maximum de tentatives (défaut : 3)
 * @param {number} initialDelay - Délai initial en millisecondes (défaut : 1000)
 */
export async function executeSupabaseWithRetry(
  queryFn,
  maxRetries = 3,
  initialDelay = 1000
) {
  let attempt = 0;
  
  while (true) {
    try {
      const result = await queryFn();
      
      // Si Supabase renvoie un objet d'erreur
      if (result?.error) {
        const errorMsg = result.error.message || "";
        const statusCode = result.error.status || 500;

        // Détection d'une erreur 500 ou de dépassement de limite de pile
        const isTransientError =
          statusCode === 500 || 
          errorMsg.includes("54001") || 
          errorMsg.toLowerCase().includes("stack depth") ||
          errorMsg.toLowerCase().includes("complex");

        if (isTransientError && attempt < maxRetries) {
          attempt++;
          const delay = initialDelay * Math.pow(2, attempt - 1);
          console.warn(
            `[Supabase Retry] Échec (code ${statusCode}). Tentative ${attempt}/${maxRetries} dans ${delay}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        
        throw result.error;
      }
      
      return result; // Succès
    } catch (err) {
      if (attempt < maxRetries) {
        attempt++;
        const delay = initialDelay * Math.pow(2, attempt - 1);
        console.warn(
          `[Supabase Retry] Exception interceptée. Tentative ${attempt}/${maxRetries} dans ${delay}ms...`,
          err
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
}

