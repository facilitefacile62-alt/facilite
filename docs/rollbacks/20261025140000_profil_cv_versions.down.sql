-- Annulation de 20261025140000_profil_cv_versions.sql (à passer par un fichier, jamais dans l'éditeur du dashboard).
-- ATTENTION : supprime les anciennes versions de CV sauvegardées (les rubriques actuelles du profil ne sont pas touchées).
DROP FUNCTION IF EXISTS public.restaurer_version_cv(UUID);
DROP FUNCTION IF EXISTS public.appliquer_rubriques_cv(JSONB, JSONB, JSONB, JSONB, JSONB);
DROP FUNCTION IF EXISTS public.rubriques_cv_vides(JSONB, JSONB, JSONB, JSONB, JSONB);
DROP TABLE IF EXISTS public.profil_cv_versions;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS rubriques_cv_le;
