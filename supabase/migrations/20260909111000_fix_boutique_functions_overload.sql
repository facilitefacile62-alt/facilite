-- Correctif immédiat de 20260909110000 : CREATE OR REPLACE FUNCTION en
-- ajoutant des paramètres DEFAULT en fin de liste n'a PAS remplacé les
-- fonctions creer_ma_boutique / modifier_ma_boutique comme attendu — Postgres
-- a créé une SECONDE surcharge (même nom, liste de types d'arguments
-- différente), les deux coexistant. Confirmé par introspection directe sur
-- la production juste après application de 20260909110000.
--
-- Le risque : un appel par paramètres nommés (PostgREST / supabase-js, donc
-- tous les appels de ce dépôt) peut devenir ambigu entre les deux surcharges
-- et échouer avec « function is not unique ». Correctif : supprimer
-- explicitement les anciennes signatures, ne garder que la nouvelle (déjà
-- dotée de son propre REVOKE/GRANT dans 20260909110000).

DROP FUNCTION IF EXISTS public.creer_ma_boutique(TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);
DROP FUNCTION IF EXISTS public.modifier_ma_boutique(UUID, TEXT, TEXT, TEXT, TEXT);
