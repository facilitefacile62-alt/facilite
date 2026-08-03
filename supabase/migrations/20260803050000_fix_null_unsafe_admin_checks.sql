-- =====================================================================
-- Corrige une classe de bug trouvée en testant la suspension (Étape 3) :
-- `IF current_user_role() <> 'admin' THEN RAISE EXCEPTION` ne se déclenche
-- PAS quand current_user_role() renvoie NULL (compte suspendu depuis
-- 20260803040000) — en logique à trois valeurs SQL, `NULL <> 'admin'` vaut
-- NULL, et `IF NULL THEN ...` ne prend jamais la branche THEN en PL/pgSQL.
-- Un compte suspendu qui avait le rôle admin AVANT sa suspension passait
-- donc silencieusement ces contrôles. `IS DISTINCT FROM` traite NULL
-- correctement (NULL IS DISTINCT FROM 'admin' vaut toujours TRUE).
--
-- Trouvé sur 4 fonctions par recherche exhaustive de ce motif exact dans
-- tout le schéma — les 4 corrigées ici, pas seulement celle qui a fait
-- échouer le test.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.approve_badge_request(request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_user_id UUID;
  target_badge TEXT;
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;

  UPDATE public.badge_requests
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = request_id AND status = 'pending'
  RETURNING user_id, requested_badge INTO target_user_id, target_badge;

  IF target_user_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.profiles
  SET badges = CASE
    WHEN badges @> to_jsonb(ARRAY[target_badge]) THEN badges
    ELSE badges || to_jsonb(ARRAY[target_badge])
  END
  WHERE id = target_user_id;

  PERFORM public.log_security_event(
    'badge_approved', 'info', auth.uid(), target_user_id,
    jsonb_build_object('badge', target_badge, 'request_id', request_id)
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_badge_request(request_id uuid, reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_user_id UUID;
  target_badge TEXT;
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;

  UPDATE public.badge_requests
  SET status = 'rejected', rejection_reason = reason, reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = request_id AND status = 'pending'
  RETURNING user_id, requested_badge INTO target_user_id, target_badge;

  IF target_user_id IS NULL THEN
    RETURN false;
  END IF;

  PERFORM public.log_security_event(
    'badge_rejected', 'info', auth.uid(), target_user_id,
    jsonb_build_object('badge', target_badge, 'request_id', request_id, 'reason', reason)
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_badge(target_user_id uuid, badge_name text, reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;

  UPDATE public.profiles
  SET badges = badges - badge_name
  WHERE id = target_user_id;

  PERFORM public.log_security_event(
    'badge_revoked', 'warning', auth.uid(), target_user_id,
    jsonb_build_object('badge', badge_name, 'reason', reason)
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.moderate_job_offer(offer_id UUID, decision TEXT, reason TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_recruiter UUID;
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;
  IF decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Décision invalide.';
  END IF;

  SELECT recruiter_id INTO target_recruiter FROM public.job_offers WHERE id = offer_id;
  IF target_recruiter IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.job_offers
  SET status = decision, status_updated_at = now()
  WHERE id = offer_id;

  PERFORM public.log_security_event(
    'job_offer_moderated', 'info', auth.uid(), target_recruiter,
    jsonb_build_object('offer_id', offer_id, 'decision', decision, 'reason', reason)
  );

  RETURN true;
END;
$$;
