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

/**
 * Un module précis + ses questions de quiz. Jamais bonne_reponse_index
 * (colonne non accordée à authenticated, voir migration 20260925140000) —
 * la correction se fait exclusivement côté serveur (soumettreQuizFormationCv).
 */
export async function obtenirModuleEtQuizFormationCv(moduleId) {
  const [{ data: module, error: erreurModule }, { data: questions, error: erreurQuestions }] = await Promise.all([
    supabase
      .from("formation_redaction_cv_modules")
      .select("id, titre, description, video_url, contenu_texte, ordre")
      .eq("id", moduleId)
      .single(),
    supabase
      .from("formation_redaction_cv_quiz_questions")
      .select("id, question, choix, ordre")
      .eq("module_id", moduleId)
      .order("ordre", { ascending: true }),
  ]);

  if (erreurModule) throw new Error(erreurModule.message || "Module introuvable.");
  if (erreurQuestions) throw new Error(erreurQuestions.message || "Impossible de charger le quiz.");

  return { module, questions: questions || [] };
}

/**
 * Ma progression pour UN module précis, ou null si jamais consulté/tenté.
 */
export async function obtenirMaProgressionModuleFormationCv(moduleId) {
  const { data, error } = await supabase
    .from("formation_redaction_cv_progression_modules")
    .select("vu, vu_le, quiz_score_pourcent, quiz_reussi, quiz_tente_le")
    .eq("module_id", moduleId)
    .maybeSingle();
  if (error) throw new Error(error.message || "Impossible de charger votre progression.");
  return data || null;
}

/**
 * Marque le module comme vu (bouton "J'ai visionné cette vidéo" — pas de
 * vrai contenu vidéo pour l'instant, voir le placeholder côté écran).
 */
export async function marquerModuleVuFormationCv(moduleId) {
  const { error } = await supabase.rpc("marquer_module_vu", { p_module_id: moduleId });
  if (error) throw new Error(error.message || "Impossible d'enregistrer votre progression.");
}

/**
 * Soumet les réponses au quiz d'un module — correction et certification
 * entièrement côté serveur (soumettre_quiz_module, SECURITY DEFINER).
 * `reponses` : [{ question_id, choix_index }, ...].
 */
export async function soumettreQuizFormationCv(moduleId, reponses) {
  const { data, error } = await supabase.rpc("soumettre_quiz_module", {
    p_module_id: moduleId,
    p_reponses: reponses,
  });
  if (error) throw new Error(error.message || "Impossible de soumettre le quiz.");
  return data;
}
