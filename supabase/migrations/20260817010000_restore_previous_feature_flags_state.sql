-- Migration 20260817010000_restore_previous_feature_flags_state.sql
--
-- Correctif de régression : la migration 20260817000000_feature_flags_table.sql
-- a seedé les 23 lignes avec enabled=true partout, copié depuis
-- DEFAULT_FEATURE_TREE (le défaut du CODE) — pas depuis l'état réel que
-- l'admin avait déjà configuré via l'ancien système localStorage (visible
-- dans les captures d'écran fournies : "Navigation & Menu Principal 9/12
-- activés", "Espace Candidat & Création CV 1/5 activé", "Espace Recrutement
-- & Entreprises 0/4 activé", "Services d'Accompagnement & Paiements 0/2
-- activé"). Résultat : le passage vers Supabase a silencieusement réactivé
-- 13 fonctionnalités que l'admin avait volontairement désactivées le temps
-- de finaliser des chantiers en cours — d'où le contournement observé
-- ("Créer votre CV" et "Services & Modèles" à nouveau accessibles).
--
-- Cette migration restaure exactement les 13 lignes visibles comme
-- Désactivé/Verrouillé sur les captures d'écran d'origine.

UPDATE public.feature_flags SET enabled = false, updated_at = now()
WHERE id IN (
  'nav_plus_importer',
  'nav_plus_service',
  'nav_plus_concours',
  'feat_creer_cv',
  'feat_modeles_cv',
  'feat_importer_cv',
  'feat_simulation_entretien',
  'feat_publier_offre',
  'feat_recruteur_dashboard',
  'feat_recruteur_cvtheque',
  'feat_demande_badge',
  'feat_commandes_agent',
  'feat_service_tarifs'
);
