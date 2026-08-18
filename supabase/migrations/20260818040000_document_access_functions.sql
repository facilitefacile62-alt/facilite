-- Création et réponse à une demande d'accès aux documents — patron
-- approve_badge_request/reject_badge_request : rôle vérifié IS DISTINCT
-- FROM (jamais <>, Invariant 8), admin_id/candidate_id fixés côté serveur
-- (auth.uid()/candidate_id vérifié via la ligne elle-même), jamais reçus
-- tels quels sans contrôle depuis le client.

CREATE OR REPLACE FUNCTION public.create_document_access_request(p_candidate_id uuid, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Un motif est requis.';
  END IF;

  INSERT INTO public.document_access_requests (admin_id, candidate_id, reason)
  VALUES (auth.uid(), p_candidate_id, trim(p_reason))
  RETURNING id INTO v_id;

  PERFORM public.log_security_event(
    'document_access_requested', 'info', auth.uid(), p_candidate_id,
    jsonb_build_object('request_id', v_id)
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_document_access_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_document_access_request(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_document_access_request(p_request_id uuid, p_decision text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_candidate_id UUID;
BEGIN
  IF p_decision NOT IN ('approved', 'denied') THEN
    RAISE EXCEPTION 'Décision invalide : % (attendu approved ou denied).', p_decision;
  END IF;

  UPDATE public.document_access_requests
  SET status = p_decision,
      decided_at = now(),
      expires_at = CASE WHEN p_decision = 'approved' THEN now() + interval '7 days' ELSE NULL END
  WHERE id = p_request_id
    AND candidate_id = auth.uid()
    AND status = 'pending'
  RETURNING candidate_id INTO v_candidate_id;

  RETURN v_candidate_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_document_access_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_document_access_request(uuid, text) TO authenticated;

-- Notifications (réutilise le système existant, patron notify_badge_change) :
-- le candidat est notifié qu'une demande arrive, l'admin est notifié de la
-- décision. type='document_access' ajouté au CHECK par la migration
-- 20260818070000 — ces triggers ne s'exécutent qu'à l'usage réel, bien
-- après l'application complète de cette série de migrations.

CREATE OR REPLACE FUNCTION public.notify_document_access_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  VALUES (
    NEW.candidate_id, NEW.admin_id, 'document_access',
    'Un administrateur demande l''accès temporaire à votre CV. Vous pouvez approuver ou refuser depuis votre espace.',
    '/candidat/securite'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_document_access_request
  AFTER INSERT ON public.document_access_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_document_access_request();

CREATE OR REPLACE FUNCTION public.notify_document_access_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
    INSERT INTO public.notifications (user_id, actor_id, type, content, link)
    VALUES (NEW.admin_id, NEW.candidate_id, 'document_access', 'Votre demande d''accès à un CV a été approuvée. Accès valable 7 jours.', '/admin');
  ELSIF OLD.status = 'pending' AND NEW.status = 'denied' THEN
    INSERT INTO public.notifications (user_id, actor_id, type, content, link)
    VALUES (NEW.admin_id, NEW.candidate_id, 'document_access', 'Votre demande d''accès à un CV a été refusée.', '/admin');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_document_access_response
  AFTER UPDATE ON public.document_access_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_document_access_response();
