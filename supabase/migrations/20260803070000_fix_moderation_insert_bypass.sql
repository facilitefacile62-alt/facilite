-- =====================================================================
-- Corrige un contournement trouvé en réparant un test cassé par la
-- migration précédente : trg_reset_job_offer_moderation ne se déclenchait
-- que BEFORE UPDATE, jamais BEFORE INSERT. Un recruteur pouvait donc
-- publier une offre en écrivant directement `status: 'approved'` dans le
-- payload d'INSERT (authenticated a un GRANT INSERT de table sur
-- job_offers, colonne status comprise) — auto-approbation complète,
-- exactement ce que "Aucune approbation automatique" interdit.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.reset_job_offer_moderation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.current_user_role() = 'admin' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending_review';
    NEW.status_updated_at := now();
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Seul un administrateur peut changer le statut de modération.';
  END IF;

  IF (NEW.title, NEW.description, NEW.location, NEW.company, NEW.contract_type,
      NEW.salary_range, NEW.min_education_level, NEW.deadline, NEW.image_url)
     IS DISTINCT FROM
     (OLD.title, OLD.description, OLD.location, OLD.company, OLD.contract_type,
      OLD.salary_range, OLD.min_education_level, OLD.deadline, OLD.image_url)
  THEN
    NEW.status := 'pending_review';
    NEW.status_updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_job_offer_moderation ON public.job_offers;
CREATE TRIGGER trg_reset_job_offer_moderation
  BEFORE INSERT OR UPDATE ON public.job_offers
  FOR EACH ROW EXECUTE FUNCTION public.reset_job_offer_moderation();
