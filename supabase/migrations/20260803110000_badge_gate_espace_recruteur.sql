-- Étape D du chantier (2026-08-03) : verified_recruiter conditionne
-- désormais TOUT l'espace recruteur (offres, candidatures, profil vitrine),
-- pas seulement la CVthèque comme avant cette migration. Un admin garde un
-- accès total sans badge (supervision). Les 5 comptes préexistants qui
-- auraient perdu l'accès ont été badgés au préalable
-- (20260803100000_badge_verified_recruiter_comptes_existants.sql).
--
-- Motif répété partout : current_user_role() = 'admin' OR
-- (current_user_role() = 'user' AND has_badge(auth.uid(),'verified_recruiter')),
-- déjà utilisé par get_candidats_recherche() et les 2 policies Storage
-- corrigées à l'Étape A de ce même chantier.

-- job_offers : créer, lire ses propres offres, modifier, supprimer.
DROP POLICY IF EXISTS "Un recruteur publie ses propres offres" ON public.job_offers;
CREATE POLICY "Un recruteur publie ses propres offres"
  ON public.job_offers FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = recruiter_id
    AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'user' AND public.has_badge(auth.uid(), 'verified_recruiter'))
    )
  );

DROP POLICY IF EXISTS "Un recruteur lit ses propres offres" ON public.job_offers;
CREATE POLICY "Un recruteur lit ses propres offres"
  ON public.job_offers FOR SELECT
  TO authenticated
  USING (
    auth.uid() = recruiter_id
    AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'user' AND public.has_badge(auth.uid(), 'verified_recruiter'))
    )
  );

DROP POLICY IF EXISTS "Un recruteur modifie ses propres offres" ON public.job_offers;
CREATE POLICY "Un recruteur modifie ses propres offres"
  ON public.job_offers FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = recruiter_id
    AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'user' AND public.has_badge(auth.uid(), 'verified_recruiter'))
    )
  )
  WITH CHECK (
    auth.uid() = recruiter_id
    AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'user' AND public.has_badge(auth.uid(), 'verified_recruiter'))
    )
  );

-- DELETE brut déjà révoqué de authenticated (Vague 2, archive_own_job_offer
-- lui a substitué une désactivation) — policy mise à jour par cohérence,
-- bien qu'actuellement inatteignable sans le GRANT.
DROP POLICY IF EXISTS "Un recruteur supprime ses propres offres" ON public.job_offers;
CREATE POLICY "Un recruteur supprime ses propres offres"
  ON public.job_offers FOR DELETE
  TO authenticated
  USING (
    auth.uid() = recruiter_id
    AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'user' AND public.has_badge(auth.uid(), 'verified_recruiter'))
    )
  );

-- candidatures : un recruteur fait avancer le statut d'une candidature reçue.
DROP POLICY IF EXISTS "Un recruteur met a jour le statut de ses candidatures" ON public.candidatures;
CREATE POLICY "Un recruteur met a jour le statut de ses candidatures"
  ON public.candidatures FOR UPDATE
  TO authenticated
  USING (
    (
      EXISTS (SELECT 1 FROM public.job_offers WHERE job_offers.id = candidatures.job_offer_id AND job_offers.recruiter_id = auth.uid())
      OR recruiter_id = auth.uid()
    )
    AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'user' AND public.has_badge(auth.uid(), 'verified_recruiter'))
    )
  )
  WITH CHECK (
    (
      EXISTS (SELECT 1 FROM public.job_offers WHERE job_offers.id = candidatures.job_offer_id AND job_offers.recruiter_id = auth.uid())
      OR recruiter_id = auth.uid()
    )
    AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'user' AND public.has_badge(auth.uid(), 'verified_recruiter'))
    )
  );

-- recruiter_profiles : créer/modifier son propre profil vitrine. La lecture
-- publique ("Lecture publique des profils recruteurs") reste inchangée —
-- décision déjà écrite dans docs/rls-policies.md, page vitrine visible par
-- tout visiteur y compris avant inscription. La suppression reste ouverte
-- sans badge : un recruteur dont le badge a été révoqué doit pouvoir
-- retirer sa propre vitrine (droit de nettoyage, pas un privilège actif).
DROP POLICY IF EXISTS "Un recruteur cree son propre profil vitrine" ON public.recruiter_profiles;
CREATE POLICY "Un recruteur cree son propre profil vitrine"
  ON public.recruiter_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'user' AND public.has_badge(auth.uid(), 'verified_recruiter'))
    )
  );

DROP POLICY IF EXISTS "Un recruteur modifie son propre profil vitrine" ON public.recruiter_profiles;
CREATE POLICY "Un recruteur modifie son propre profil vitrine"
  ON public.recruiter_profiles FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'user' AND public.has_badge(auth.uid(), 'verified_recruiter'))
    )
  );

-- get_recruiter_candidatures() (SECURITY DEFINER, bypasse RLS) : même garde,
-- sinon un compte non badgé qui possédait déjà des candidatures avant cette
-- bascule continuerait à les lire via ce chemin même sans badge.
CREATE OR REPLACE FUNCTION public.get_recruiter_candidatures(p_job_offer_id uuid DEFAULT NULL::uuid, p_page integer DEFAULT 0)
RETURNS TABLE(
  id uuid, job_offer_id uuid, job_title text, full_name text, email text, cv_url text,
  status text, cv_match_score integer, created_at timestamptz, status_changed_at timestamptz,
  first_response_at timestamptz, contact_revealed boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
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
    AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'user' AND public.has_badge(auth.uid(), 'verified_recruiter'))
    )
  ORDER BY c.created_at DESC
  LIMIT 50 OFFSET GREATEST(p_page, 0) * 50;
$$;
