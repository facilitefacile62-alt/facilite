-- Annulation de 20261024220000_achat_de_cv_catalogue.sql (à passer par un fichier, jamais dans l'éditeur du dashboard).
-- ATTENTION : supprime le catalogue et les achats de CV.
-- Les deux buckets privés (cv-modeles-apercus, cv-modeles-livres) NE se suppriment PAS en SQL (Supabase l'interdit) : une fois vides, ils se
-- retirent par l'API Storage (deleteBucket). Vides et privés, sans aucune règle, ils ne présentent aucun risque en attendant.
DROP FUNCTION IF EXISTS public.lister_modeles_cv();
DROP TABLE IF EXISTS public.cv_achats;
DROP TABLE IF EXISTS public.cv_modeles;
