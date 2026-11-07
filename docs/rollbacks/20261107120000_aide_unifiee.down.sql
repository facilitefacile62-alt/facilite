-- Retour arrière de 20261107120000_aide_unifiee.sql (non appliqué automatiquement).
-- Les vocaux déjà enregistrés doivent d'abord être supprimés par l'API Storage (pas par SQL) :
-- vider le bucket « aide-vocaux » avant de le supprimer.
DELETE FROM public.feature_flags WHERE id = 'feat_aide_unifiee';
DROP FUNCTION IF EXISTS public.aide_modifier_reglages(JSONB);
DROP FUNCTION IF EXISTS public.aide_historique_admin(UUID);
DROP FUNCTION IF EXISTS public.aide_vocaux_a_purger(INTEGER);
DROP FUNCTION IF EXISTS public.aide_cout_actuel();
DROP FUNCTION IF EXISTS public.aide_enregistrer_usage(TEXT, INTEGER, INTEGER, INTEGER, BIGINT);
DROP FUNCTION IF EXISTS public.aide_reserver_vocal(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.aide_reserver_ia(UUID, INTEGER);
DROP TABLE IF EXISTS public.aide_messages_vocaux;
DROP TABLE IF EXISTS public.aide_reponses_cache;
DROP TABLE IF EXISTS public.aide_usage_utilisateur_jour;
DROP TABLE IF EXISTS public.aide_usage_jour;
DROP TABLE IF EXISTS public.aide_reglages;
DELETE FROM storage.buckets WHERE id = 'aide-vocaux';
