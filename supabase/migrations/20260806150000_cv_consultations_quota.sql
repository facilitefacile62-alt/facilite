-- =====================================================================
-- Quota quotidien de consultations de profil candidat par recruteur badgé.
--
-- Contexte : /api/recruteur/candidats-recherche (via get_candidats_recherche())
-- est le seul point d'entrée du répertoire candidats, déjà authentifié et
-- rate-limité au débit (requêtes/minute), mais rien ne bornait le VOLUME
-- total consultable par jour — un recruteur badgé légitime pouvait parcourir
-- l'intégralité de la base candidats en une soirée. Seuil de départ : 100
-- candidats distincts/jour/compte badgé — largement au-dessus de ce qu'une
-- vraie campagne de recrutement consulte en une journée, mais assez bas
-- pour qu'un pillage complet prenne plusieurs jours au lieu d'une session,
-- avec une alerte dès le premier jour où le seuil est atteint plutôt
-- qu'après coup. Les admins ne sont pas soumis au quota (autorité de
-- modération déjà plus large, cf. get_candidats_recherche()).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.cv_consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (recruiter_id, candidate_id, viewed_date)
);

CREATE INDEX IF NOT EXISTS idx_cv_consultations_recruiter_date ON public.cv_consultations(recruiter_id, viewed_date);

ALTER TABLE public.cv_consultations ENABLE ROW LEVEL SECURITY;

-- Aucune policy, aucun GRANT à anon/authenticated : lecture et écriture
-- exclusivement via les deux fonctions SECURITY DEFINER ci-dessous, jamais
-- un SELECT/INSERT direct — même schéma que security_logs. RLS activée +
-- 0 policy = fermée par défaut (Invariant 2), ce qui est le but ici.
REVOKE ALL ON public.cv_consultations FROM authenticated, anon;

-- Point d'écriture + décision d'autorisation, appelé une fois par page de
-- résultats depuis /api/recruteur/candidats-recherche avec les uuid de la
-- page en cours. Idempotent pour un même candidat le même jour (ON CONFLICT
-- DO NOTHING) : re-consulter un profil déjà vu aujourd'hui ne consomme pas
-- le quota une deuxième fois. Retourne, pour chaque uuid en entrée, s'il est
-- autorisé (déjà vu aujourd'hui, admin, ou sous le seuil) ou bloqué (seuil
-- atteint pour un candidat jamais vu aujourd'hui) — la route appelante
-- filtre les données déjà chargées sur cette base, elle ne les récupère
-- jamais pour un candidat marqué bloqué.
CREATE OR REPLACE FUNCTION public.record_cv_consultations(p_candidate_ids UUID[])
RETURNS TABLE(candidate_id UUID, allowed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_recruiter_id UUID := auth.uid();
  v_daily_limit CONSTANT INT := 100;
  v_today DATE := (now() AT TIME ZONE 'utc')::date;
  v_used_count INT;
  v_is_admin BOOLEAN;
  v_cid UUID;
  v_already_seen BOOLEAN;
  v_blocked_any BOOLEAN := false;
BEGIN
  IF v_recruiter_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  v_is_admin := public.current_user_role() = 'admin';

  SELECT count(*) INTO v_used_count
  FROM public.cv_consultations c
  WHERE c.recruiter_id = v_recruiter_id AND c.viewed_date = v_today;

  FOREACH v_cid IN ARRAY COALESCE(p_candidate_ids, ARRAY[]::UUID[])
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM public.cv_consultations c
      WHERE c.recruiter_id = v_recruiter_id AND c.candidate_id = v_cid AND c.viewed_date = v_today
    ) INTO v_already_seen;

    IF v_already_seen OR v_is_admin THEN
      candidate_id := v_cid;
      allowed := true;
      RETURN NEXT;
    ELSIF v_used_count < v_daily_limit THEN
      INSERT INTO public.cv_consultations (recruiter_id, candidate_id, viewed_date)
      VALUES (v_recruiter_id, v_cid, v_today)
      ON CONFLICT ON CONSTRAINT cv_consultations_recruiter_id_candidate_id_viewed_date_key DO NOTHING;
      v_used_count := v_used_count + 1;
      candidate_id := v_cid;
      allowed := true;
      RETURN NEXT;
    ELSE
      candidate_id := v_cid;
      allowed := false;
      v_blocked_any := true;
      RETURN NEXT;
    END IF;
  END LOOP;

  IF v_blocked_any THEN
    PERFORM public.log_security_event(
      'cv_quota_exceeded',
      'warning',
      v_recruiter_id,
      NULL,
      jsonb_build_object('daily_limit', v_daily_limit, 'viewed_date', v_today)
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_cv_consultations(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_cv_consultations(UUID[]) TO authenticated;

-- Résumé en lecture seule pour le compteur affiché en permanence côté UI
-- (jamais l'enforcement lui-même, qui reste dans record_cv_consultations
-- ci-dessus — celle-ci ne fait qu'informer).
CREATE OR REPLACE FUNCTION public.get_cv_quota_today()
RETURNS TABLE(used_count INT, daily_limit INT, remaining INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_recruiter_id UUID := auth.uid();
  v_daily_limit CONSTANT INT := 100;
  v_used INT;
BEGIN
  IF v_recruiter_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  SELECT count(*) INTO v_used
  FROM public.cv_consultations
  WHERE recruiter_id = v_recruiter_id AND viewed_date = (now() AT TIME ZONE 'utc')::date;

  used_count := v_used;
  daily_limit := v_daily_limit;
  remaining := GREATEST(0, v_daily_limit - v_used);
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.get_cv_quota_today() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_cv_quota_today() TO authenticated;
