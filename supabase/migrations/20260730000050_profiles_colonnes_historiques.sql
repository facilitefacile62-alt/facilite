-- Colonnes de public.profiles créées à l'origine directement dans le tableau de bord Supabase, sans fichier de migration.
-- Elles existent déjà en production (cette migration n'y change rien : IF NOT EXISTS) ; elle sert à ce qu'une base
-- reconstruite depuis zéro (CI « Supabase DB Lint », supabase start) puisse rejouer 20260730000100_recruteur_cvtheque.sql,
-- dont la vue candidats_recherche lit ces colonnes. Types identiques à la production.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cv_url TEXT,
  ADD COLUMN IF NOT EXISTS cv_name TEXT,
  ADD COLUMN IF NOT EXISTS cv_visible_recruteurs BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_test_account BOOLEAN NOT NULL DEFAULT false;
