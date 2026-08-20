-- Restaure reset_job_offer_moderation() à sa forme sécurisée d'origine
-- (20260803070000_fix_moderation_insert_bypass.sql). Le 2026-08-18 (commit
-- e3f37e5, message "fix(db): ensure admin and service_role published
-- offers are instantly approved without pending_review trigger lock"),
-- une clause de contournement a été ajoutée :
--
--   IF current_user IN ('postgres', 'supabase_admin')
--      OR (auth.jwt() ->> 'role') = 'service_role'
--      OR auth.role() = 'service_role'
--      OR public.current_user_role() = 'admin' THEN
--
-- ...et SET search_path = '' a disparu au passage (invariant 3 rouge
-- depuis). Même motif que le contournement du trigger de sponsoring
-- restauré le 2026-08-20 (20260820130000_restore_sponsorship_trigger.sql) :
-- un OR service_role ajouté à côté d'une vérification admin déjà
-- existante, élargissant qui peut publier une offre déjà 'approved' sans
-- repasser par la modération (webhooksWorker.js, ou tout appelant en
-- clé service_role). Recherche systématique le 2026-08-20 sur toutes les
-- fonctions (public, prokind='f') et policies RLS (public + storage) : deux
-- autres fonctions mentionnent service_role
-- (prevent_order_status_spoofing, protect_cosmetic_columns) mais leur
-- design d'origine (01-02/08, avant l'incident) en fait le seul acteur de
-- confiance dès la conception, pas un OR ajouté à côté d'un contrôle
-- admin — motif différent, non concernées. Aucune policy RLS ne mentionne
-- service_role. reset_job_offer_moderation est la seule occurrence
-- restante de ce motif précis.

CREATE OR REPLACE FUNCTION public.reset_job_offer_moderation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
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
