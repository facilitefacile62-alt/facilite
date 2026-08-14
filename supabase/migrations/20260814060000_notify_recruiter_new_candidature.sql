-- NOTIFICATIONS — déclencheur 1/4 : nouvelle candidature reçue -> notifie
-- le recruteur.
--
-- Trigger plutôt qu'un appel applicatif dans postuler/route.js : seul ce
-- fichier insère aujourd'hui dans candidatures (vérifié — grep exhaustif
-- sur src/), mais un trigger couvre aussi tout futur point d'insertion
-- (import, action admin...) sans travail supplémentaire, et centralise la
-- logique de notification à un seul endroit pour les 4 déclencheurs à venir.
--
-- SECURITY DEFINER indispensable : la connexion qui déclenche l'INSERT est
-- authenticated (le candidat), qui n'a aucun GRANT INSERT sur notifications
-- (20260814030000_notifications.sql) — sans DEFINER, le trigger échouerait
-- avec "permission denied for table notifications".
--
-- Pas de notification si aucun recruteur identifié (recruiter_id NULL) :
-- cohérent avec la décision restaurée dans postuler/route.js (Option A,
-- jamais de fallback admin/support pour les candidatures sans recruteur).

CREATE OR REPLACE FUNCTION public.notify_recruiter_new_candidature()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.recruiter_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, actor_id, type, content, link)
    VALUES (
      NEW.recruiter_id,
      NEW.user_id,
      'candidature',
      COALESCE(NEW.full_name, 'Un candidat') || ' a postulé pour ' || COALESCE(NEW.job_title, 'votre offre'),
      '/recruteur'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_recruiter_new_candidature ON public.candidatures;
CREATE TRIGGER trg_notify_recruiter_new_candidature
  AFTER INSERT ON public.candidatures
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_recruiter_new_candidature();
