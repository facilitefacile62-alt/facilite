-- Migration: Feature flags pour filtres des offres et matching IA
DELETE FROM public.feature_flags WHERE id IN ('feat_offres_recherche', 'feat_offres_filtre_ville');

INSERT INTO public.feature_flags (id, branch_id, name, path, enabled, roles, updated_at)
VALUES 
(
  'feat_offres_filtres',
  'branch_nav',
  'Filtres sur les offres d''emploi',
  '/offres',
  true,
  '{"user": true, "visitor": true, "recruiter": true}'::jsonb,
  now()
),
(
  'feat_offres_recherche_ia',
  'branch_nav',
  'Recherche Sémantique IA sur les Offres',
  '/offres',
  true,
  '{"user": true, "visitor": true, "recruiter": true}'::jsonb,
  now()
),
(
  'feat_offres_onglets_status',
  'branch_nav',
  'Onglets Offres Disponibles & Expirées',
  '/offres',
  true,
  '{"user": true, "visitor": true, "recruiter": true}'::jsonb,
  now()
),
(
  'feat_matching_ia_postuler',
  'branch_nav',
  'Matching IA Candidat-Offre (Avertisseur)',
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
