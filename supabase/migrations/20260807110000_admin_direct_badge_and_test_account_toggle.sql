-- =====================================================================
-- Partie C du chantier admin (2026-08-07) : attribution directe du badge
-- "Recruteur vérifié" et bascule du drapeau "Compte de test" depuis la
-- liste des comptes de l'admin — jusqu'ici uniquement possible par un
-- UPDATE SQL manuel (aucune fonction ne le permettait).
--
-- Même contrat que revoke_badge/approve_badge_request (20260802080000,
-- 20260802140000) : SECURITY DEFINER + vérification interne
-- current_user_role() = 'admin' + search_path figé + journalisation
-- systématique dans security_logs. La révocation du badge réutilise le
-- revoke_badge existant (pas dupliqué ici) — seule l'attribution directe
-- manquait.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.grant_verified_recruiter_badge(target_user_id UUID, reason TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;

  UPDATE public.profiles
  SET badges = CASE
    WHEN badges @> to_jsonb(ARRAY['verified_recruiter']) THEN badges
    ELSE badges || to_jsonb(ARRAY['verified_recruiter'])
  END
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  PERFORM public.log_security_event(
    'badge_granted_direct', 'info', auth.uid(), target_user_id,
    jsonb_build_object('badge', 'verified_recruiter', 'reason', reason)
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_verified_recruiter_badge(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_verified_recruiter_badge(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_test_account_flag(target_user_id UUID, is_test BOOLEAN, reason TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;

  UPDATE public.profiles
  SET is_test_account = is_test
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  PERFORM public.log_security_event(
    'test_account_flag_changed', 'info', auth.uid(), target_user_id,
    jsonb_build_object('is_test_account', is_test, 'reason', reason)
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.set_test_account_flag(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_test_account_flag(UUID, BOOLEAN, TEXT) TO authenticated;
