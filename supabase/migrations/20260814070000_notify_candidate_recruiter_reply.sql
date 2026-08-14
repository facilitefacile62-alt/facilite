-- NOTIFICATIONS — déclencheur 2/4 : réponse du recruteur -> notifie le
-- candidat.
--
-- messages n'a aucune colonne de rôle ni de nom recruteur/entreprise. La
-- distinction recruteur->candidat / candidat->recruteur et le nom de
-- l'entreprise viennent de candidatures, qui lie déjà précisément un
-- recruiter_id à un user_id (candidat) — même relation que le déclencheur
-- 1/4 (20260814060000). Un message est "une réponse du recruteur" quand il
-- existe une ligne candidatures où recruiter_id = messages.sender_id AND
-- user_id = messages.receiver_id : exclut naturellement les messages
-- candidat->recruteur (le candidat n'est jamais recruiter_id de sa propre
-- candidature) et les messages entre utilisateurs sans candidature commune.
--
-- SECURITY DEFINER : mêmes raisons que 20260814060000 (l'expéditeur du
-- message est authenticated, aucun GRANT INSERT sur notifications).

CREATE OR REPLACE FUNCTION public.notify_candidate_recruiter_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company TEXT;
  v_job_title TEXT;
BEGIN
  SELECT company, job_title INTO v_company, v_job_title
  FROM public.candidatures
  WHERE recruiter_id = NEW.sender_id AND user_id = NEW.receiver_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    INSERT INTO public.notifications (user_id, actor_id, type, content, link)
    VALUES (
      NEW.receiver_id,
      NEW.sender_id,
      'reponse',
      'Le recruteur de ' || COALESCE(v_company, 'cette entreprise') || ' vous a répondu concernant ' || COALESCE(v_job_title, 'votre candidature'),
      '/messagerie'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_candidate_recruiter_reply ON public.messages;
CREATE TRIGGER trg_notify_candidate_recruiter_reply
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_candidate_recruiter_reply();
