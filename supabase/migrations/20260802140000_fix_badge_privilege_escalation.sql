-- Correctif escalade de privilèges (signalé après revue) : publisher
-- pouvait approuver/rejeter/révoquer des badges — un publisher complice
-- pouvait créer un compte, déposer une demande verified_recruiter et
-- l'approuver lui-même, obtenant l'accès à toute la CVthèque. Le publisher
-- garde le droit de LIRE la file (policy SELECT déjà en place, inchangée
-- ici) mais plus de la trancher.
--
-- Découverte en creusant : authenticated a un GRANT UPDATE/DELETE de TABLE
-- sur badge_requests (même défaut Supabase déjà rencontré sur profiles,
-- confirmé via information_schema.role_table_grants) — la policy
-- "Un moderateur traite les demandes de badge" était donc la SEULE
-- protection contre une écriture directe (hors des fonctions), pas
-- seulement une commodité. Un publisher aurait pu faire
-- `supabase.from('badge_requests').update({status:'approved'})`
-- directement, sans jamais passer par approve_badge_request() — n'aurait
-- pas mis à jour profiles.badges (seule la fonction le fait), mais aurait
-- corrompu la trace d'audit (reviewed_by/reviewed_at forgés). Corrigé par
-- REVOKE : toute écriture sur cette table passe désormais exclusivement
-- par les fonctions SECURITY DEFINER, INSERT (dépôt de sa propre demande)
-- mis à part.

REVOKE UPDATE, DELETE ON public.badge_requests FROM authenticated, anon;

DROP POLICY IF EXISTS "Un moderateur traite les demandes de badge" ON public.badge_requests;
CREATE POLICY "Un admin traite les demandes de badge" ON public.badge_requests
  FOR UPDATE USING (public.current_user_role() = 'admin');

-- official_staff n'est plus une valeur demandable : ne s'attribue qu'en
-- SQL direct par un admin (voir docs/acces-secours.md pour la procédure).
-- Un utilisateur qui tenterait de le demander via l'API directe se heurte
-- désormais à cette contrainte, pas seulement à une validation applicative
-- contournable.
ALTER TABLE public.badge_requests DROP CONSTRAINT IF EXISTS badge_requests_requested_badge_check;
ALTER TABLE public.badge_requests
  ADD CONSTRAINT badge_requests_requested_badge_check CHECK (requested_badge = 'verified_recruiter');

CREATE OR REPLACE FUNCTION public.approve_badge_request(request_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_user_id UUID;
  target_badge TEXT;
BEGIN
  IF public.current_user_role() <> 'admin' THEN
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

CREATE OR REPLACE FUNCTION public.reject_badge_request(request_id UUID, reason TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_user_id UUID;
  target_badge TEXT;
BEGIN
  IF public.current_user_role() <> 'admin' THEN
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

CREATE OR REPLACE FUNCTION public.revoke_badge(target_user_id UUID, badge_name TEXT, reason TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.current_user_role() <> 'admin' THEN
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
