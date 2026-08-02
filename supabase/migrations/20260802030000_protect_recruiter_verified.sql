-- Le trigger prevent_role_self_escalation (20260729232500) protège déjà
-- profiles.role contre l'auto-modification. La colonne recruiter_verified
-- ajoutée par 20260802020000 est tout aussi sensible (c'est la porte
-- d'accès au répertoire candidats) mais n'était protégée par rien : un
-- recruteur non validé pouvait s'auto-approuver directement depuis la
-- console du navigateur via
-- `supabase.from('profiles').update({ recruiter_verified: true })`,
-- contournant entièrement la validation admin.
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS TRIGGER AS $$
DECLARE
  acting_is_admin BOOLEAN;
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.recruiter_verified IS DISTINCT FROM OLD.recruiter_verified)
     AND auth.role() <> 'service_role' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ) INTO acting_is_admin;

    IF NOT acting_is_admin THEN
      NEW.role := OLD.role;
      NEW.recruiter_verified := OLD.recruiter_verified;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- Le trigger trg_prevent_role_self_escalation (BEFORE UPDATE) existe déjà et
-- appelle cette fonction : CREATE OR REPLACE suffit, pas besoin de le recréer.
