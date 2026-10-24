-- Annulation de 20261024220000_achat_de_cv_catalogue.sql (à passer par un fichier, jamais dans l'éditeur du dashboard).
-- ATTENTION : supprime le catalogue et les achats de CV. Vider d'abord les deux buckets (les objets doivent être supprimés avant les buckets).
DROP FUNCTION IF EXISTS public.lister_modeles_cv();
DROP TABLE IF EXISTS public.cv_achats;
DROP TABLE IF EXISTS public.cv_modeles;
DELETE FROM storage.buckets WHERE id IN ('cv-modeles-apercus', 'cv-modeles-livres');
