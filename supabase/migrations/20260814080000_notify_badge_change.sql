-- NOTIFICATIONS — déclencheur 3/4 : badge approuvé/révoqué -> notifie
-- l'utilisateur concerné.
--
-- profiles.badges (pas badge_requests) : approve_badge_request() met à
-- jour badge_requests.status ET profiles.badges dans la même fonction ;
-- revoke_badge() ne touche JAMAIS badge_requests, uniquement
-- profiles.badges directement. Un trigger sur badge_requests manquerait
-- donc toutes les révocations — profiles.badges est le seul point de
-- convergence des deux mécanismes.
--
-- Distinction approbation/révocation par différence d'ensemble entre
-- OLD.badges et NEW.badges (tableaux JSONB de chaînes).
--
-- SECURITY DEFINER : mêmes raisons que les déclencheurs 1/4 et 2/4.
-- actor_id = auth.uid() : l'admin qui a appelé approve_badge_request/
-- revoke_badge — auth.uid() lit les claims JWT de la connexion, reste
-- correct même imbriqué dans deux niveaux de SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.notify_badge_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_badge TEXT;
  v_label TEXT;
BEGIN
  FOR v_badge IN
    SELECT value FROM jsonb_array_elements_text(COALESCE(NEW.badges, '[]'::jsonb))
    EXCEPT
    SELECT value FROM jsonb_array_elements_text(COALESCE(OLD.badges, '[]'::jsonb))
  LOOP
    v_label := CASE v_badge
      WHEN 'verified_recruiter' THEN 'Recruteur vérifié'
      WHEN 'official_staff' THEN 'Équipe Facilite'
      WHEN 'administrateur' THEN 'Administrateur'
      ELSE v_badge
    END;
    INSERT INTO public.notifications (user_id, actor_id, type, content, link)
    VALUES (NEW.id, auth.uid(), 'badge', 'Félicitations, votre badge "' || v_label || '" a été approuvé !', '/profil');
  END LOOP;

  FOR v_badge IN
    SELECT value FROM jsonb_array_elements_text(COALESCE(OLD.badges, '[]'::jsonb))
    EXCEPT
    SELECT value FROM jsonb_array_elements_text(COALESCE(NEW.badges, '[]'::jsonb))
  LOOP
    v_label := CASE v_badge
      WHEN 'verified_recruiter' THEN 'Recruteur vérifié'
      WHEN 'official_staff' THEN 'Équipe Facilite'
      WHEN 'administrateur' THEN 'Administrateur'
      ELSE v_badge
    END;
    INSERT INTO public.notifications (user_id, actor_id, type, content, link)
    VALUES (NEW.id, auth.uid(), 'badge', 'Votre badge "' || v_label || '" a été révoqué.', '/profil');
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_badge_change ON public.profiles;
CREATE TRIGGER trg_notify_badge_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (OLD.badges IS DISTINCT FROM NEW.badges)
  EXECUTE FUNCTION public.notify_badge_change();
