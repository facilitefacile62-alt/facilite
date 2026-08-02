import { getSupabaseAdmin } from "./supabaseAdmin";

// Partagé par les 6 routes IA qui n'ont pas de coût déjà plafonné par un
// système de crédits (contrairement à /api/cv/improve-text) — voir l'audit
// sécurité, référentiel 101-150, point 146.
export const AI_DAILY_QUOTA = 40;

/**
 * Incrémente atomiquement le compteur d'appels IA du jour pour cet
 * utilisateur (RPC increment_ai_usage, service_role uniquement) et renvoie
 * si l'appel est autorisé.
 *
 * Fail-open sur une erreur d'infrastructure (RPC/réseau) plutôt que de
 * bloquer toutes les fonctionnalités IA de la plateforme sur un incident
 * transitoire — même philosophie que checkRateLimit (apiAuth.js), qui
 * dégrade plutôt que de tout couper. L'erreur reste loguée bruyamment pour
 * rester visible.
 */
export async function checkAiQuota(userId) {
  try {
    const admin = getSupabaseAdmin();
    const { data: allowed, error } = await admin.rpc("increment_ai_usage", {
      p_user_id: userId,
      p_max_daily: AI_DAILY_QUOTA,
    });

    if (error) {
      console.error("[AI Quota] Échec de la vérification du quota, requête autorisée par défaut :", error.message);
      return true;
    }

    return allowed === true;
  } catch (err) {
    console.error("[AI Quota] Exception lors de la vérification du quota :", err?.message);
    return true;
  }
}
