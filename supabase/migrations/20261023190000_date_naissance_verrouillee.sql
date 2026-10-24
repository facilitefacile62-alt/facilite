-- La date de naissance ne change jamais une fois renseignée (décision du 23/10/2026) : la même sur Facilité, sur Locaux et sur le site.
-- Règle posée en BASE (le site et l'application ne font que l'afficher en lecture seule) : un utilisateur connecté peut la renseigner s'il
-- n'en a pas encore, jamais la modifier ni l'effacer ensuite. Les corrections exceptionnelles passent par le serveur (clé service) ou la base.
CREATE OR REPLACE FUNCTION public.verrouiller_date_naissance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.date_naissance IS NOT NULL
     AND NEW.date_naissance IS DISTINCT FROM OLD.date_naissance
     AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'La date de naissance ne peut plus être modifiée.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS verrouiller_date_naissance ON public.profiles;
CREATE TRIGGER verrouiller_date_naissance
  BEFORE UPDATE OF date_naissance ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.verrouiller_date_naissance();
