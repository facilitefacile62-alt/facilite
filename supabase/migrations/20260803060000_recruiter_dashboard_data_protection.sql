-- =====================================================================
-- ÉTAPE 4 du chantier — tableau de bord recruteur : protection des
-- données candidat (non négociable) + entonnoir de recrutement.
-- =====================================================================

-- 1. Vues d'offre — compteur agrégé, pas une table de logs par vue (le
-- volume attendu ne justifie pas plus, et "compteurs agrégés côté base"
-- est explicitement demandé).
ALTER TABLE public.job_offers ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_offer_view(offer_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.job_offers SET view_count = view_count + 1
  WHERE id = offer_id AND status = 'approved' AND is_active = true AND archived_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.increment_offer_view(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_offer_view(UUID) TO authenticated, anon;

-- 2. Entonnoir de recrutement — étape "Contactés" ajoutée entre présélection
-- et entretien ; chaque changement horodate status_changed_at, et
-- first_response_at capture le délai de première réaction (KPI "délai
-- moyen de première réponse").
ALTER TABLE public.candidatures
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contact_revealed BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.candidatures DROP CONSTRAINT IF EXISTS candidatures_status_check;
ALTER TABLE public.candidatures ADD CONSTRAINT candidatures_status_check
  CHECK (status IN ('pending', 'reviewed', 'contacted', 'interview_scheduled', 'accepted', 'rejected'));

CREATE OR REPLACE FUNCTION public.track_candidature_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at := now();
    IF OLD.status = 'pending' AND NEW.first_response_at IS NULL THEN
      NEW.first_response_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_candidature_stage_change ON public.candidatures;
CREATE TRIGGER trg_track_candidature_stage_change
  BEFORE UPDATE ON public.candidatures
  FOR EACH ROW EXECUTE FUNCTION public.track_candidature_stage_change();

-- 3. Consentement du candidat à révéler ses coordonnées à CE recruteur pour
-- CETTE candidature — jamais global, jamais implicite. Seul le candidat lui-
-- même peut l'activer (le recruteur ne peut jamais se l'accorder lui-même).
CREATE OR REPLACE FUNCTION public.reveal_contact_to_recruiter(candidature_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  owner UUID;
BEGIN
  SELECT user_id INTO owner FROM public.candidatures WHERE id = candidature_id;
  IF owner IS NULL OR owner <> auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez révéler vos coordonnées que sur vos propres candidatures.';
  END IF;

  UPDATE public.candidatures SET contact_revealed = true WHERE id = candidature_id;

  PERFORM public.log_security_event(
    'candidate_contact_revealed', 'info', auth.uid(), auth.uid(),
    jsonb_build_object('candidature_id', candidature_id)
  );

  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.reveal_contact_to_recruiter(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reveal_contact_to_recruiter(UUID) TO authenticated;

-- 4. Lecture recruteur — coordonnées masquées tant que non révélées,
-- pagination plafonnée en dur (jamais une liste illimitée), isolation
-- stricte aux propres offres/candidatures spontanées du recruteur appelant.
-- SECURITY DEFINER : contourne la RLS, donc le filtrage par recruteur est
-- refait explicitement ici (même discipline que get_candidats_recherche).
CREATE OR REPLACE FUNCTION public.get_recruiter_candidatures(p_job_offer_id UUID DEFAULT NULL, p_page INTEGER DEFAULT 0)
RETURNS TABLE (
  id UUID, job_offer_id UUID, job_title TEXT, full_name TEXT, email TEXT, cv_url TEXT,
  status TEXT, cv_match_score INTEGER, created_at TIMESTAMPTZ, status_changed_at TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ, contact_revealed BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    c.id, c.job_offer_id, COALESCE(jo.title, c.job_title), c.full_name,
    CASE WHEN c.contact_revealed THEN c.email ELSE NULL END,
    CASE WHEN c.contact_revealed THEN c.cv_url ELSE NULL END,
    c.status, c.cv_match_score, c.created_at, c.status_changed_at, c.first_response_at, c.contact_revealed
  FROM public.candidatures c
  LEFT JOIN public.job_offers jo ON jo.id = c.job_offer_id
  WHERE (jo.recruiter_id = auth.uid() OR c.recruiter_id = auth.uid())
    AND (p_job_offer_id IS NULL OR c.job_offer_id = p_job_offer_id)
  ORDER BY c.created_at DESC
  -- Plafond dur : 50 par page, jamais une liste non paginée quelle que
  -- soit la valeur demandée côté client.
  LIMIT 50 OFFSET GREATEST(p_page, 0) * 50;
$$;
REVOKE ALL ON FUNCTION public.get_recruiter_candidatures(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_recruiter_candidatures(UUID, INTEGER) TO authenticated;

-- 5. Consultation de profil candidat journalisée : quel recruteur, quel
-- candidat, quand. Appelée explicitement par la route/le composant qui
-- ouvre une fiche candidat en détail (pas à chaque ligne de tableau, pour
-- ne pas noyer security_logs — un vrai "coup d'œil" sur une fiche).
CREATE OR REPLACE FUNCTION public.log_candidate_profile_view(candidate_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'user' OR NOT public.has_badge(auth.uid(), 'verified_recruiter') THEN
    RAISE EXCEPTION 'Réservé aux recruteurs vérifiés.';
  END IF;

  PERFORM public.log_security_event(
    'candidate_profile_viewed', 'info', auth.uid(), candidate_id, '{}'::jsonb
  );
END;
$$;
REVOKE ALL ON FUNCTION public.log_candidate_profile_view(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_candidate_profile_view(UUID) TO authenticated;
