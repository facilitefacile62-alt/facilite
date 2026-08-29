-- Migration: Ajout du feature flag feat_offres_filtres pour activer/désactiver les filtres sur les offres
INSERT INTO public.feature_flags (id, branch_id, name, path, enabled, roles, updated_at)
VALUES (
  'feat_offres_filtres',
  'branch_nav',
  'Filtres & Recherche des Offres',
  '/offres',
  true,
  '{"user": true, "visitor": true, "recruiter": true}'::jsonb,
  now()
)
ON CONFLICT (id) DO UPDATE 
SET 
  branch_id = EXCLUDED.branch_id,
  name = EXCLUDED.name,
  path = EXCLUDED.path,
  updated_at = now();
