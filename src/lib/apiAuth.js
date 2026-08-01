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

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const requestLog = new Map();

/**
 * Limitation de débit par utilisateur authentifié.
 *
 * Limite connue : le compteur vit en mémoire du processus. Il est donc remis à
 * zéro à chaque redéploiement et n'est pas partagé entre instances serverless
 * concurrentes. C'est un garde-fou utile contre l'abus basique, PAS une défense
 * solide contre un attaquant déterminé. Migrer vers Upstash Redis pour un quota
 * réellement distribué et persistant.
 */
export function checkRateLimit(identifier) {
  const now = Date.now();

  // Purge périodique pour éviter une croissance mémoire non bornée
  if (requestLog.size > 1000) {
    for (const [key, timestamps] of requestLog.entries()) {
      const encoreValides = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (encoreValides.length === 0) requestLog.delete(key);
      else requestLog.set(key, encoreValides);
    }
  }

  const timestamps = (requestLog.get(identifier) || []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );

  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      error: NextResponse.json(
        { error: "Trop de requêtes, réessayez dans une minute." },
        { status: 429 }
      ),
    };
  }

  timestamps.push(now);
  requestLog.set(identifier, timestamps);
  return { allowed: true, error: null };
}
