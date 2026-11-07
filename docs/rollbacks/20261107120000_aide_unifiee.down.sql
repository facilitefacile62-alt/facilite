-- Retour arrière de 20261107120000_aide_unifiee.sql (non appliqué automatiquement).
-- ORDRE À SUIVRE :
--  1. Couper l'interrupteur feat_aide_unifiee (la dernière ligne de ce fichier le supprime de toute façon).
--  2. Vider le bucket « aide-vocaux » par l'API Storage ou le tableau de bord (jamais par SQL : le déclencheur
--     de la plateforme storage.protect_delete() refuse tout DELETE direct sur storage.objects).
--  3. Jouer ce fichier. La suppression du bucket ci-dessous n'aboutit que s'il est VIDE (même garde que
--     docs/rollbacks/20261029100000_modeles_documents.down.sql) ; si la plateforme la refuse, supprimer le bucket
--     vide par l'API Storage.
--  4. La purge quotidienne n'est PAS une tâche de base de données : c'est la route /api/cron/aide-purge-vocaux
--     déclarée dans vercel.json. Elle disparaît en retirant le code (revert des commits de la branche aide-unifiee) ;
--     tant que le code est en ligne, elle répondra 500 une fois les fonctions supprimées, sans autre effet.
--  Ne sont PAS supprimées, par choix : les lignes déjà écrites dans assistant_messages, messages (SUPPORT)
--  et support_threads, qui sont des données de la personne et du support, pas des objets de cette migration.
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
DELETE FROM storage.buckets WHERE id = 'aide-vocaux' AND NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'aide-vocaux');
