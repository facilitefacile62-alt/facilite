/**
 * Validation stricte des variables d'environnement.
 *
 * Sans ce garde-fou, un déploiement mal configuré démarrait quand même en
 * retombant sur des identifiants Supabase codés en dur : un environnement de
 * test écrivait alors silencieusement dans la base de PRODUCTION.
 * On préfère un échec bruyant au démarrage à une corruption silencieuse.
 */

function required(name) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `[Configuration] Variable d'environnement manquante : ${name}. ` +
        `Renseignez-la (fichier .env.local en local, dashboard Vercel en production) ` +
        `avant de démarrer l'application.`
    );
  }
  return value;
}

/**
 * Clés réservées au serveur. Volontairement non validées au chargement du
 * module : les routes IA dégradent proprement (cascade Groq -> Gemini ->
 * DeepSeek) quand l'une d'elles manque, et le build ne doit pas échouer
 * pour autant.
 */
export function optionalServerKey(name) {
  const value = process.env[name];
  if (!value || value.includes("[") || value.trim() === "") return null;
  return value;
}

export const SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL");
export const SUPABASE_ANON_KEY = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
