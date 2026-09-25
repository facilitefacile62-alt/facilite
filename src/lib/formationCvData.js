import { supabase } from "@/lib/supabase";

// Lectures centralisées pour la formation payante "Rédaction de CV" (voir
// migrations 20260925140000/150000) — même convention que marketplaceData.js
// pour les autres fonctionnalités : la logique d'accès aux données vit ici,
// pas éparpillée dans les composants.

/**
 * L'inscription de l'utilisateur connecté, ou null s'il ne s'est jamais
 * inscrit (aucune ligne créée avant le premier essai de paiement).
 */
export async function obtenirMonInscriptionFormationCv() {
  const { data, error } = await supabase
    .from("formation_redaction_cv_inscriptions")
    .select("id, paye, paye_le, certifie, certifie_le, provider_reference")
    .maybeSingle();
  if (error) throw new Error(error.message || "Impossible de charger votre inscription.");
  return data || null;
}
