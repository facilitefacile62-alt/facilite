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
// requête API authentifiée tant qu'Upstash n'est pas configuré.
//
// Mise à jour 2026-08-24 : les deux variables SONT désormais présentes dans
// l'environnement Vercel (Production + Preview, ajoutées le 02/08/2026) et
// le déploiement servant ffacilite.com leur est postérieur — la production
// tourne donc bien sur le chemin Redis distribué, plus sur le repli mémoire.
// Le repli reste en place pour le dev local et pour une panne d'Upstash.
let redis;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
      // Le SDK réessaie 5 fois avec backoff exponentiel par défaut. Contre
      // un hôte injoignable, chaque tentative attend l'expiration TCP :
      // additionnées, elles dépassent la durée maximale d'une fonction
      // Vercel et la requête meurt en 504 au lieu de dégrader. Une seule
      // reprise rapide suffit ici — le repli mémoire prend le relais
      // ensuite.
      retry: { retries: 1, backoff: () => 200 },
    });
  } catch (e) {
    console.warn("[Rate Limiter] Échec d'initialisation Upstash Redis. Mode dégradé en mémoire locale.");
  }
} else {
  console.warn("[Rate Limiter] Upstash Redis non configuré (UPSTASH_REDIS_REST_URL/_TOKEN absents). Mode dégradé en mémoire locale.");
}

const localFallbackLog = new Map();

// Plafond de patience côté Redis. Même ordre de grandeur que les
// withTimeout() du middleware (src/proxy.js, 1500 ms) : au-delà, la
// limitation de débit n'est plus qu'un confort et ne doit en aucun cas
// retenir la requête de l'utilisateur.
const REDIS_TIMEOUT_MS = 1000;

/**
 * Limitation de débit distribuée (Redis) ou dégradée en mémoire.
 *
 * INCIDENT DE PRODUCTION 2026-08-28 — 504 FUNCTION_INVOCATION_TIMEOUT à la
 * connexion. checkRateLimit() est appelée par ~29 routes API, dont
 * /api/auth/confirm-after-login qui part immédiatement après CHAQUE
 * connexion réussie. L'appel Redis n'était borné par rien : le `catch`
 * ci-dessous n'attrape qu'une ERREUR, jamais un blocage. Avec un Upstash
 * injoignable, l'attente dépassait la durée maximale de la fonction et
 * Vercel tuait la requête — l'utilisateur ne pouvait plus se connecter du
 * tout, alors qu'un simple repli mémoire aurait suffi.
 *
 * Le chemin Redis est donc désormais borné par Promise.race : dépassement
 * du délai => on retombe sur le compteur mémoire, exactement comme sur une
 * erreur réseau. La limitation devient locale à l'instance le temps de
 * l'incident, ce qui est très précisément le rôle de ce repli.
 */
export async function checkRateLimit(identifier) {
  if (redis) {
    try {
      const key = `rate-limit:${identifier}`;
      
      // `NX` est indispensable : sans lui, EXPIRE repositionne le TTL à 60s
      // à CHAQUE requête, donc la clé n'expire jamais tant que l'utilisateur
      // continue d'appeler l'API, et INCR ne repart jamais de zéro — un
      // utilisateur actif est alors bloqué DÉFINITIVEMENT dès sa 20e requête
      // (et non pendant une minute), jusqu'à ce qu'il cesse tout appel
      // pendant 60s d'affilée. Avec NX, le TTL n'est posé qu'à la création
      // de la clé : la fenêtre glisse réellement de minute en minute.
      const pipelinePromise = redis.pipeline()
        .incr(key)
        .expire(key, RATE_LIMIT_WINDOW_S, "NX")
        .exec();

      // Promise.race plutôt qu'un simple await : sans borne, une seule
      // indisponibilité d'Upstash suffit à faire tomber toutes les
      // connexions en 504.
      const resultat = await Promise.race([
        pipelinePromise,
        new Promise((resolve) => setTimeout(() => resolve(null), REDIS_TIMEOUT_MS)),
      ]);

      if (resultat === null) {
        console.warn(`[Rate Limiter] Redis n'a pas répondu en ${REDIS_TIMEOUT_MS}ms — repli mémoire pour cette requête.`);
        throw new Error("redis_timeout");
      }

      const [current] = resultat;
        
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
