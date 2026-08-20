-- Incident du 18/08 — Phase 1, point 2/3 : restaure prevent_sponsorship_self_edit()
-- à sa version d'origine (migration 20260818090000_sponsored_offers.sql).
--
-- Entre le 18/08 et le 20/08, cette fonction a été modifiée directement en
-- base (aucun commit, aucun fichier de migration ne documente ce
-- changement — recherché exhaustivement dans tout l'historique git) pour
-- ajouter une clause de contournement :
--   IF (auth.jwt() ->> 'role') = 'service_role' OR auth.role() = 'service_role' OR ...
-- Cette clause permettait à n'importe quel appel authentifié avec la clé
-- service_role (utilisée par webhooksWorker.js, sans lien avec un
-- administrateur réel) de modifier is_sponsored/sponsored_until/
-- sponsor_priority librement — contournant entièrement la règle "admin
-- uniquement" que ce trigger existe pour faire respecter. Le SET
-- search_path qui figurait dans la version d'origine avait également
-- disparu (Invariant 3, rouge depuis).
--
-- Testé en direct le 20/08 : un appel avec la clé service_role modifiait
-- silencieusement is_sponsored=true sans lever d'exception.

CREATE OR REPLACE FUNCTION public.prevent_sponsorship_self_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.current_user_role() = 'admin' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.is_sponsored IS TRUE OR NEW.sponsored_until IS NOT NULL OR NEW.sponsor_priority IS DISTINCT FROM 0 THEN
      RAISE EXCEPTION 'is_sponsored, sponsored_until et sponsor_priority sont réservés aux administrateurs.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.is_sponsored IS DISTINCT FROM OLD.is_sponsored
     OR NEW.sponsored_until IS DISTINCT FROM OLD.sponsored_until
     OR NEW.sponsor_priority IS DISTINCT FROM OLD.sponsor_priority THEN
    RAISE EXCEPTION 'is_sponsored, sponsored_until et sponsor_priority sont réservés aux administrateurs.';
  END IF;
  RETURN NEW;
END;
$$;
