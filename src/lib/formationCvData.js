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

/**
 * Tous les modules, dans l'ordre. Accès temporairement ouvert à tout
 * compte connecté (migration 20260925160000) — pas de vérification paye
 * ici, juste la lecture RLS-scopée par "auth.uid() IS NOT NULL".
 */
export async function obtenirModulesFormationCv() {
  const { data, error } = await supabase
    .from("formation_redaction_cv_modules")
    .select("id, titre, description, video_url, ordre")
    .order("ordre", { ascending: true });
  if (error) throw new Error(error.message || "Impossible de charger les modules.");
  return data || [];
}

/**
 * La progression de l'utilisateur connecté, un enregistrement par module
 * déjà consulté ou tenté (aucune ligne pour un module jamais ouvert).
 */
export async function obtenirMaProgressionFormationCv() {
  const { data, error } = await supabase
    .from("formation_redaction_cv_progression_modules")
    .select("module_id, vu, vu_le, quiz_score_pourcent, quiz_reussi, quiz_tente_le");
  if (error) throw new Error(error.message || "Impossible de charger votre progression.");
  return data || [];
}
