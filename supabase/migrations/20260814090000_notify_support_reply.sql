-- NOTIFICATIONS — déclencheur 4/4 : réponse du support -> notifie
-- l'utilisateur.
--
-- messages n'a pas de rôle stocké. Réutilise la convention déjà en place
-- et auditée dans sync_support_thread() (20260730050000_support_multirole.sql) :
-- v_requester = COALESCE(receiver_id, sender_id) — le premier message
-- d'une demande a receiver_id NULL (pas d'admin ciblé), donc sender_id
-- EST le demandeur ; une réponse renseigne receiver_id = demandeur. Un
-- message est "une réponse du support" quand sender_id != v_requester.
--
-- SECURITY DEFINER : mêmes raisons que les 3 déclencheurs précédents.
-- content volontairement générique (pas d'extrait du message) : les
-- échanges de support peuvent contenir des détails personnels sensibles.

CREATE OR REPLACE FUNCTION public.notify_support_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_requester UUID;
BEGIN
  v_requester := COALESCE(NEW.receiver_id, NEW.sender_id);

  -- v_requester nul seulement si sender_id l'est aussi (cas théorique,
  -- jamais produit par le flux applicatif) — et sender_id = v_requester
  -- signifie que c'est le demandeur qui écrit (premier message ou
  -- relance), pas une réponse du support.
  IF v_requester IS NULL OR NEW.sender_id = v_requester THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  VALUES (v_requester, NEW.sender_id, 'message', 'Le support Facilite vous a répondu.', '/messagerie');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_support_reply ON public.messages;
CREATE TRIGGER trg_notify_support_reply
  AFTER INSERT ON public.messages
  FOR EACH ROW
  WHEN (NEW.type_discussion = 'SUPPORT')
  EXECUTE FUNCTION public.notify_support_reply();
