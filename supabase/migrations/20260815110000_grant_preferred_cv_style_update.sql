-- Migration 20260815110000_grant_preferred_cv_style_update.sql
-- public.profiles utilise des GRANTs UPDATE par colonne pour authenticated
-- (29 colonnes existantes listées explicitement) — ALTER TABLE ADD COLUMN
-- (migration précédente 20260815100000) n'étend jamais automatiquement
-- cette liste. Sans ce GRANT, tout update client-side sur cette colonne
-- échoue avec "permission denied for table profiles" malgré une policy RLS
-- UPDATE owner-only déjà en place (auth.uid() = id) : le blocage a lieu
-- avant même l'évaluation de la RLS, au niveau du GRANT de base.
-- Constaté en direct en testant point 3.2 (sauvegarde automatique du style
-- CV préféré) : un no-op update sur une colonne existante (bio) réussissait
-- normalement, seul preferred_cv_style échouait.

GRANT UPDATE (preferred_cv_style) ON public.profiles TO authenticated;
