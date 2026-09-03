-- Quota IA dédié à la banque de CV.
--
-- POURQUOI PAS LE QUOTA PARTAGÉ EXISTANT (ai_usage_daily, 40/jour)
--
-- Ce quota protège 6 routes IA contre un usage incontrôlé (voir aiQuota.js :
-- « partagé par les routes qui n'ont pas de coût déjà plafonné »). Un import
-- groupé de CV en consomme un par fichier : quelques dizaines de CV
-- épuiseraient le quota du jour pour TOUTES les autres fonctionnalités IA de
-- l'admin (Studio IA, extraction d'affiche d'offre...), et bloqueraient même
-- la recherche dans la banque qu'on vient de remplir.
--
-- Importer des dizaines ou centaines de CV dans un vivier qu'on curate
-- soi-même est un usage légitime, pas l'abus que le quota partagé visait à
-- prévenir. La banque de CV obtient donc son propre compteur, séparé,
-- avec un plafond nettement plus généreux — sans toucher au quota des 6
-- autres routes, qui gardent exactement leur protection actuelle.
--
-- Compteur dédié plutôt qu'un p_max_daily plus élevé passé au RPC existant :
-- increment_ai_usage stocke un seul total par (user_id, jour), partagé par
-- tous les appelants. Y passer un plafond différent depuis la banque de CV
-- aurait aussi élevé le plafond effectif des 6 autres routes, car c'est la
-- même ligne qui est incrémentée.

CREATE TABLE IF NOT EXISTS public.banque_cv_usage_daily (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date  DATE NOT NULL,
  call_count  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);

ALTER TABLE public.banque_cv_usage_daily ENABLE ROW LEVEL SECURITY;
-- Même doctrine que banque_cv elle-même : aucune policy, aucun grant à
-- authenticated/anon. Seules les routes /api/admin/banque-cv/* (service_role)
-- y touchent.

CREATE OR REPLACE FUNCTION public.increment_banque_cv_usage(p_user_id UUID, p_max_daily INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  rows_affected INT;
BEGIN
  INSERT INTO public.banque_cv_usage_daily (user_id, usage_date, call_count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, usage_date) DO UPDATE
    SET call_count = banque_cv_usage_daily.call_count + 1
    WHERE banque_cv_usage_daily.call_count < p_max_daily;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_banque_cv_usage(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_banque_cv_usage(UUID, INTEGER) TO service_role;
