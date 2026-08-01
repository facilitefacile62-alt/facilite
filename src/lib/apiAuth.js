import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./env";

const supabaseServer = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Valide le JWT porté par l'en-tête Authorization auprès des serveurs Supabase.
 *
 * getUser(token) effectue une vérification réelle de la signature et de
 * l'expiration du jeton — contrairement à getSession(), qui se contente de lire
 * le jeton local et ne prouve rien côté serveur.
 */
export async function requireUser(req) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return { user: null, error: NextResponse.json({ error: "Non autorisé." }, { status: 401 }) };
  }

  const { data, error } = await supabaseServer.auth.getUser(token);

  if (error || !data?.user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Session invalide ou expirée." }, { status: 401 }),
    };
  }

  // Vérifier qu'au moins un identifiant (Email ou Téléphone) est confirmé (mesure de sécurité hybride)
  const isEmailConfirmed = !!data.user.email_confirmed_at;
  const isPhoneConfirmed = !!data.user.phone_confirmed_at;
  
  if (!isEmailConfirmed && !isPhoneConfirmed) {
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
