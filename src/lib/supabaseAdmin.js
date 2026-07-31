import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

/**
 * Client Supabase "service_role" : contourne systématiquement RLS.
 *
 * Réservé aux traitements serveur qui doivent agir pour le compte du système
 * (webhook Paystack, génération de facture) plutôt que pour un utilisateur
 * authentifié précis. Ne jamais exposer ce client ou la clé au navigateur.
 *
 * Volontairement instancié à l'appel (pas au chargement du module) : la clé
 * peut être absente en développement tant que le module Paiement n'est pas
 * configuré, sans faire échouer le build ni les autres routes API.
 */
export function getSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "[Configuration] Variable d'environnement manquante : SUPABASE_SERVICE_ROLE_KEY. " +
        "Requise pour les traitements serveur (webhook Paystack, génération de facture)."
    );
  }

  return createClient(SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
