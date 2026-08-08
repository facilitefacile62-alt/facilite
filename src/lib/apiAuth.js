import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./env";

const supabaseServer = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Journalise un refus d'accès (401/403) via log_access_denial() — jamais
 * bloquant : un échec de journalisation ne doit jamais faire échouer la
 * réponse d'autorisation elle-même. Best-effort, silencieux, même schéma
 * que les notifications WhatsApp (src/lib/notifications.js).
 *
 * Portée volontaire (4B du chantier du 2026-08-06,
 * docs/incident-2026-08-06.md) : appelé uniquement par les routes qui
 * passent explicitement `logDenials: true` à requireUser() — pas toutes les
 * routes authentifiées d'un coup, seulement celles touchant à des données
 * personnelles pour l'instant (CVthèque, candidatures).
 */
async function logAccessDenial(req, actorId, statusCode, reason) {
  try {
    const { getSupabaseAdmin } = await import("./supabaseAdmin");
    const admin = getSupabaseAdmin();
    const forwardedFor = req.headers.get("x-forwarded-for") || "";
    const ip = forwardedFor.split(",")[0].trim() || null;
    const route = new URL(req.url).pathname;
    await admin.rpc("log_access_denial", {
      p_actor_id: actorId,
      p_ip_address: ip,
      p_route: route,
      p_status_code: statusCode,
      p_reason: reason,
    });
  } catch (err) {
    console.warn("[apiAuth] Échec journalisation du refus d'accès (non bloquant) :", err?.message);
  }
}

/**
 * Valide le JWT porté par l'en-tête Authorization auprès des serveurs Supabase.
 *
 * getUser(token) effectue une vérification réelle de la signature et de
 * l'expiration du jeton — contrairement à getSession(), qui se contente de lire
 * le jeton local et ne prouve rien côté serveur.
 */
export async function requireUser(req, { logDenials = false } = {}) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    if (logDenials) await logAccessDenial(req, null, 401, "missing_token");
    return { user: null, error: NextResponse.json({ error: "Non autorisé." }, { status: 401 }) };
  }

  const { data, error } = await supabaseServer.auth.getUser(token);

  if (error || !data?.user) {
    if (logDenials) await logAccessDenial(req, null, 401, "invalid_or_expired_session");
    return {
      user: null,
      error: NextResponse.json({ error: "Session invalide ou expirée." }, { status: 401 }),
    };
  }

  // Vérifier qu'au moins un identifiant (Email ou Téléphone) est confirmé (mesure de sécurité hybride)
  const isEmailConfirmed = !!data.user.email_confirmed_at;
  const isPhoneConfirmed = !!data.user.phone_confirmed_at;

  if (!isEmailConfirmed && !isPhoneConfirmed) {
    if (logDenials) await logAccessDenial(req, data.user.id, 403, "no_confirmed_identifier");
    return {
      user: null,
      error: NextResponse.json({ error: "Votre compte doit avoir au moins un identifiant (Email ou Téléphone) vérifié." }, { status: 403 }),
    };
  }

  // Déterminer l'identifiant principal actif pour les logs ou limites personnalisées
  const primaryIdentifier = data.user.email || data.user.phone || data.user.id;

  return { user: data.user, identifier: primaryIdentifier, error: null };
}

import { Redis } from "@upstash/redis";

const RATE_LIMIT_WINDOW_S = 60; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20;

// Le constructeur Redis() n'échoue jamais quand url/token manquent — il se
// contente d'un warning interne et renvoie un client non fonctionnel. Sans
// cette vérification explicite, chaque appel à checkRateLimit() tentait
// quand même pipeline().exec() sur ce client invalide, qui échoue au bout
// de ~4.3s (retries internes du SDK avant l'erreur "Failed to parse URL")
// avant de retomber sur le mode mémoire — 4+ secondes ajoutées à CHAQUE
// requête API authentifiée tant qu'Upstash n'est pas configuré (constaté en
// production : ni UPSTASH_REDIS_REST_URL ni _TOKEN n'y sont renseignés).
let redis;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  } catch (e) {
    console.warn("[Rate Limiter] Échec d'initialisation Upstash Redis. Mode dégradé en mémoire locale.");
  }
} else {
  console.warn("[Rate Limiter] Upstash Redis non configuré (UPSTASH_REDIS_REST_URL/_TOKEN absents). Mode dégradé en mémoire locale.");
}

const localFallbackLog = new Map();

/**
 * Limitation de débit distribuée (Redis) ou dégradée en mémoire.
 */
export async function checkRateLimit(identifier) {
  if (redis) {
    try {
      const key = `rate-limit:${identifier}`;
      
      const [current] = await redis.pipeline()
        .incr(key)
        .expire(key, RATE_LIMIT_WINDOW_S)
        .exec();
        
      if (current > RATE_LIMIT_MAX_REQUESTS) {
        return {
          allowed: false,
          error: NextResponse.json({ error: "Trop de requêtes, réessayez dans une minute." }, { status: 429 }),
        };
      }
      return { allowed: true, error: null };
    } catch (error) {
      console.error("[Rate Limiter Redis Error]", error);
      // Fallback au local en cas d'erreur réseau Redis
    }
  }

  // Fallback Local Memory
  const now = Date.now();
  if (localFallbackLog.size > 1000) {
    for (const [key, timestamps] of localFallbackLog.entries()) {
      const valides = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_S * 1000);
      if (valides.length === 0) localFallbackLog.delete(key);
      else localFallbackLog.set(key, valides);
    }
  }

  const timestamps = (localFallbackLog.get(identifier) || []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_S * 1000
  );

  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      error: NextResponse.json({ error: "Trop de requêtes, réessayez dans une minute." }, { status: 429 }),
    };
  }

  timestamps.push(now);
  localFallbackLog.set(identifier, timestamps);
  return { allowed: true, error: null };
}

/**
 * Variante de requireUser() pour les routes atteintes par NAVIGATION
 * navigateur plutôt que par un fetch() avec en-tête Authorization (ex. un
 * bouton "use client" qui fait router.push() vers une route API, ou une
 * redirection OAuth tierce) — un en-tête Authorization: Bearer n'est jamais
 * envoyé par le navigateur lors d'une navigation, seul le cookie de session
 * Supabase l'est. Même mécanisme que middleware.js (createServerClient +
 * cookies), adapté à l'API cookies() de next/headers disponible dans un
 * Route Handler.
 */
export async function getUserFromCookies() {
  const cookieStore = await cookies();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // set() peut échouer selon le contexte d'exécution du Route Handler
          // (hors construction de la réponse) — sans conséquence pour la
          // lecture de session ci-dessous.
        }
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
