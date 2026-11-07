-- Contrôle EN LECTURE SEULE de la migration 20261107120000_aide_unifiee.sql, à lancer APRÈS son application
-- (uniquement sur « go » écrit), par exemple avec runIntrospectionSql (tests/helpers/privilegedSql.js).
-- Ne contient que des SELECT. Chaque ligne : controle, ok (true/false), detail. Tout `ok = false` est un échec.

WITH cibles(nom) AS (
  VALUES ('aide_reglages'), ('aide_usage_jour'), ('aide_usage_utilisateur_jour'), ('aide_reponses_cache'), ('aide_messages_vocaux')
),
fonctions_serveur(nom) AS (
  VALUES ('aide_reserver_ia'), ('aide_reserver_vocal'), ('aide_enregistrer_usage'), ('aide_cout_actuel'), ('aide_vocaux_a_purger')
),
fonctions_admin(nom) AS (
  VALUES ('aide_historique_admin'), ('aide_modifier_reglages')
)

-- 1. Les 5 tables existent et ont la RLS activée (invariant 2)
SELECT 'table_rls_activee:' || c.nom AS controle,
       coalesce(t.relrowsecurity, false) AS ok,
       CASE WHEN t.oid IS NULL THEN 'table absente' ELSE 'relrowsecurity=' || t.relrowsecurity END AS detail
FROM cibles c
LEFT JOIN pg_class t ON t.relname = c.nom AND t.relnamespace = 'public'::regnamespace

UNION ALL
-- 2. Chaque table a au moins une policy (aucune table « RLS sans policy » non justifiée)
SELECT 'table_a_une_policy:' || c.nom,
       count(p.polname) > 0,
       count(p.polname) || ' policy(s)'
FROM cibles c
LEFT JOIN pg_class t ON t.relname = c.nom AND t.relnamespace = 'public'::regnamespace
LEFT JOIN pg_policy p ON p.polrelid = t.oid
GROUP BY c.nom

UNION ALL
-- 3. Aucune policy tautologique (USING true) sur ces tables (invariant 7)
SELECT 'aucune_policy_tautologique',
       count(*) = 0,
       coalesce(string_agg(t.relname || ':' || p.polname, ', '), 'aucune')
FROM pg_policy p
JOIN pg_class t ON t.oid = p.polrelid AND t.relnamespace = 'public'::regnamespace
WHERE t.relname IN (SELECT nom FROM cibles)
  AND lower(regexp_replace(coalesce(pg_get_expr(p.polqual, p.polrelid), ''), '\s', '', 'g')) IN ('true', '(true)')

UNION ALL
-- 4. Droits de table : anon n'a rien ; authenticated n'a que SELECT (invariant 1 : jamais UPDATE/DELETE/INSERT/TRUNCATE)
SELECT 'droits_table_interdits_anon_authenticated',
       count(*) = 0,
       coalesce(string_agg(g.table_name || ':' || g.grantee || ':' || g.privilege_type, ', '), 'aucun')
FROM information_schema.role_table_grants g
WHERE g.table_schema = 'public'
  AND g.table_name IN (SELECT nom FROM cibles)
  AND (g.grantee = 'anon' OR (g.grantee = 'authenticated' AND g.privilege_type <> 'SELECT'))

UNION ALL
-- 5. Les 7 fonctions existent, sont SECURITY DEFINER avec search_path figé à '' (invariant 3)
SELECT 'fonction_definer_search_path:' || f.nom,
       coalesce(p.prosecdef AND coalesce(p.proconfig::text LIKE '%search_path=""%', false), false),
       CASE WHEN p.oid IS NULL THEN 'fonction absente'
            ELSE 'prosecdef=' || p.prosecdef || ' config=' || coalesce(p.proconfig::text, 'NULL') END
FROM (SELECT nom FROM fonctions_serveur UNION ALL SELECT nom FROM fonctions_admin) f
LEFT JOIN pg_proc p ON p.proname = f.nom AND p.pronamespace = 'public'::regnamespace

UNION ALL
-- 6. Fonctions « serveur » : ni PUBLIC, ni anon, ni authenticated ne peuvent les exécuter ; service_role oui
SELECT 'fonction_serveur_execute_restreint:' || f.nom,
       p.oid IS NOT NULL
         AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
         AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
         AND has_function_privilege('service_role', p.oid, 'EXECUTE'),
       CASE WHEN p.oid IS NULL THEN 'fonction absente'
            ELSE 'anon=' || has_function_privilege('anon', p.oid, 'EXECUTE')
              || ' authenticated=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')
              || ' service_role=' || has_function_privilege('service_role', p.oid, 'EXECUTE') END
FROM fonctions_serveur f
LEFT JOIN pg_proc p ON p.proname = f.nom AND p.pronamespace = 'public'::regnamespace

UNION ALL
-- 7. Fonctions « admin » : authenticated peut les appeler (elles refusent elles-mêmes les non-admins), anon non (invariant 13)
SELECT 'fonction_admin_execute:' || f.nom,
       p.oid IS NOT NULL
         AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
         AND NOT has_function_privilege('anon', p.oid, 'EXECUTE'),
       CASE WHEN p.oid IS NULL THEN 'fonction absente'
            ELSE 'anon=' || has_function_privilege('anon', p.oid, 'EXECUTE')
              || ' authenticated=' || has_function_privilege('authenticated', p.oid, 'EXECUTE') END
FROM fonctions_admin f
LEFT JOIN pg_proc p ON p.proname = f.nom AND p.pronamespace = 'public'::regnamespace

UNION ALL
-- 8. Bucket aide-vocaux : existe, PRIVÉ (invariant 4), limité à 1 Mo, formats audio seulement
SELECT 'bucket_aide_vocaux_prive',
       b.id IS NOT NULL AND b.public = false AND b.file_size_limit = 1048576 AND b.allowed_mime_types IS NOT NULL,
       CASE WHEN b.id IS NULL THEN 'bucket absent'
            ELSE 'public=' || b.public || ' limite=' || coalesce(b.file_size_limit::text, 'NULL') || ' mimes=' || coalesce(array_to_string(b.allowed_mime_types, ','), 'NULL') END
FROM (SELECT 1) un
LEFT JOIN storage.buckets b ON b.id = 'aide-vocaux'

UNION ALL
-- 9. Aucune policy storage.objects ne mentionne ce bucket (accès uniquement par le serveur, adresses signées)
SELECT 'aucune_policy_storage_sur_aide_vocaux',
       count(*) = 0,
       coalesce(string_agg(p.polname, ', '), 'aucune')
FROM pg_policy p
JOIN pg_class t ON t.oid = p.polrelid AND t.relname = 'objects' AND t.relnamespace = 'storage'::regnamespace
WHERE coalesce(pg_get_expr(p.polqual, p.polrelid), '') || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') LIKE '%aide-vocaux%'

UNION ALL
-- 10. Interrupteur du panneau : présent et DÉSACTIVÉ
SELECT 'interrupteur_feat_aide_unifiee_desactive',
       ff.id IS NOT NULL AND ff.enabled = false,
       CASE WHEN ff.id IS NULL THEN 'ligne absente' ELSE 'enabled=' || ff.enabled END
FROM (SELECT 1) un
LEFT JOIN public.feature_flags ff ON ff.id = 'feat_aide_unifiee'

UNION ALL
-- 11. Réglages : une seule ligne, IA COUPÉE par défaut, plafonds 1 $ / 5 $
SELECT 'reglages_par_defaut_surs',
       count(*) = 1 AND bool_and(ia_active = false) AND bool_and(plafond_jour_usd = 1.00) AND bool_and(plafond_mois_usd = 5.00),
       count(*) || ' ligne(s)'
FROM public.aide_reglages

ORDER BY 2, 1;
