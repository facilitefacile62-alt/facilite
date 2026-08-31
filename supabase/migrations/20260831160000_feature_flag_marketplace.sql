-- Migration 20260831160000_feature_flag_marketplace.sql
-- Ajout du feature flag pour la plateforme Marketplace dans l'arbre d'autorisations

INSERT INTO public.feature_flags (id, branch_id, name, path, enabled, roles, updated_at)
VALUES (
  'nav_marketplace',
  'branch_nav',
  'Marketplace (Sélection du jour & Ventes)',
  '/marketplace',
  true,
  '{"user": true, "recruiter": true, "visitor": true}'::jsonb,
  now()
)
ON CONFLICT (id) DO NOTHING;
