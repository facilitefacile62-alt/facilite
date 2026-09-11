-- Correctif immédiat de 20260911220000 : même mécanisme que l'incident du
-- 09/09 (voir 20260909111000_fix_boutique_functions_overload.sql) —
-- CREATE OR REPLACE FUNCTION en ajoutant p_mode_horaires en fin de liste de
-- paramètres n'a PAS remplacé creer_ma_boutique / modifier_ma_boutique
-- comme attendu : une liste de types d'arguments différente fait créer à
-- Postgres une SECONDE surcharge plutôt que de remplacer la première.
--
-- Confirmé par introspection directe sur pg_proc juste après application de
-- 20260911220000 : creer_ma_boutique existait en 11 ET 12 paramètres,
-- modifier_ma_boutique en 8 ET 9 paramètres.
--
-- Le risque, identique à celui du 09/09 : un appel par paramètres nommés
-- (PostgREST / supabase-js, donc tous les appels de ce dépôt) peut devenir
-- ambigu entre les deux surcharges et échouer avec « function is not
-- unique ». Correctif : supprimer explicitement les anciennes signatures
-- (sans p_mode_horaires), ne garder que les nouvelles — déjà dotées de leur
-- propre REVOKE/GRANT dans 20260911220000.

DROP FUNCTION IF EXISTS public.creer_ma_boutique(TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.modifier_ma_boutique(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
