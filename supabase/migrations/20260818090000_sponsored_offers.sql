-- Offres sponsorisées : 3 colonnes sur job_offers, activation manuelle par un
-- admin uniquement (pas de webhook de paiement automatique pour l'instant —
-- décision explicite tant que KPay n'a pas confirmé un paiement réel abouti).
--
-- Un recruteur a déjà une policy UPDATE row-level lui permettant de modifier
-- SA PROPRE offre ("Un recruteur modifie ses propres offres", sans
-- restriction de colonne — RLS est row-level, pas column-level). Sans garde
-- supplémentaire, il pourrait donc s'auto-déclarer sponsorisé via un simple
-- .update() sur sa propre offre. Corrigé par un trigger BEFORE INSERT OR
-- UPDATE qui bloque tout changement de ces 3 colonnes hors admin — même
-- patron que prevent_document_access_request_tampering (20260818000000) et
-- prevent_badge_request_tampering, adapté à un blocage conditionnel au rôle
-- plutôt qu'à une immutabilité totale.

ALTER TABLE public.job_offers
  ADD COLUMN is_sponsored BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN sponsored_until TIMESTAMPTZ,
  ADD COLUMN sponsor_priority INT NOT NULL DEFAULT 0;

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

CREATE TRIGGER trg_prevent_sponsorship_self_edit
  BEFORE INSERT OR UPDATE ON public.job_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_sponsorship_self_edit();

-- Chemin serveur unique pour activer/désactiver le sponsoring — patron
-- identique à moderate_job_offer (admin_page.js), IS DISTINCT FROM plutôt
-- que <> (Invariant 8), journalisé via log_security_event comme toute
-- action admin sensible de ce dépôt.
CREATE OR REPLACE FUNCTION public.set_offer_sponsorship(
  p_offer_id uuid,
  p_is_sponsored boolean,
  p_sponsored_until timestamptz DEFAULT NULL,
  p_sponsor_priority int DEFAULT 0
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  target_recruiter UUID;
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;

  IF p_is_sponsored AND p_sponsored_until IS NULL THEN
    RAISE EXCEPTION 'sponsored_until est requis pour activer le sponsoring.';
  END IF;

  SELECT recruiter_id INTO target_recruiter FROM public.job_offers WHERE id = p_offer_id;
  IF target_recruiter IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.job_offers
  SET is_sponsored = p_is_sponsored,
      sponsored_until = CASE WHEN p_is_sponsored THEN p_sponsored_until ELSE NULL END,
      sponsor_priority = COALESCE(p_sponsor_priority, 0)
  WHERE id = p_offer_id;

  PERFORM public.log_security_event(
    'job_offer_sponsorship_changed', 'info', auth.uid(), target_recruiter,
    jsonb_build_object(
      'offer_id', p_offer_id, 'is_sponsored', p_is_sponsored,
      'sponsored_until', p_sponsored_until, 'sponsor_priority', p_sponsor_priority
    )
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.set_offer_sponsorship(uuid, boolean, timestamptz, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_offer_sponsorship(uuid, boolean, timestamptz, int) TO authenticated;
