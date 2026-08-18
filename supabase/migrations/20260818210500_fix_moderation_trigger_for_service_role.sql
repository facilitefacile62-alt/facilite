-- ==============================================================================
-- MIGRATION : Correction du trigger de modération pour service_role & admin
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.reset_job_offer_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin')
     OR (auth.jwt() ->> 'role') = 'service_role' 
     OR auth.role() = 'service_role' 
     OR public.current_user_role() = 'admin' THEN
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
