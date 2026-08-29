-- Migration: Séparation des filtres et outils de recherche d'offres en feature flags individuels
DELETE FROM public.feature_flags WHERE id = 'feat_offres_filtres';

INSERT INTO public.feature_flags (id, branch_id, name, path, enabled, roles, updated_at)
VALUES 
(
  'feat_offres_recherche',
  'branch_nav',
  'Recherche d''Offres (Mots-clés / Titre)',
  '/offres',
  true,
  '{"user": true, "visitor": true, "recruiter": true}'::jsonb,
  now()
),
(
  'feat_offres_filtre_ville',
  'branch_nav',
  'Filtre Localisation / Ville',
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
)
ON CONFLICT (id) DO UPDATE 
SET 
  branch_id = EXCLUDED.branch_id,
  name = EXCLUDED.name,
  path = EXCLUDED.path,
  updated_at = now();
