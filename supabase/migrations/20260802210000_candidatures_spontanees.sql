-- =====================================================================
-- CANDIDATURES SPONTANÉES : Ajout de recruiter_id
-- =====================================================================

-- 1. Ajouter la colonne recruiter_id à candidatures
ALTER TABLE public.candidatures
  ADD COLUMN IF NOT EXISTS recruiter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_candidatures_recruiter_id ON public.candidatures(recruiter_id);

-- 2. Modifier la politique RLS de lecture pour les recruteurs
DROP POLICY IF EXISTS "Un recruteur lit les candidatures de ses offres" ON public.candidatures;
CREATE POLICY "Un recruteur lit les candidatures de ses offres" ON public.candidatures
  FOR SELECT USING (
    -- Cas 1 : Candidature sur une offre appartenant au recruteur
    EXISTS (
      SELECT 1 FROM public.job_offers
      WHERE job_offers.id = candidatures.job_offer_id
        AND job_offers.recruiter_id = auth.uid()
    )
    OR
    -- Cas 2 : Candidature spontanée envoyée directement à ce recruteur
    (candidatures.recruiter_id = auth.uid())
  );

-- 3. Modifier la politique RLS de mise à jour (statut) pour les recruteurs
DROP POLICY IF EXISTS "Un recruteur met a jour le statut de ses candidatures" ON public.candidatures;
CREATE POLICY "Un recruteur met a jour le statut de ses candidatures" ON public.candidatures
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.job_offers
      WHERE job_offers.id = candidatures.job_offer_id
        AND job_offers.recruiter_id = auth.uid()
    )
    OR
    (candidatures.recruiter_id = auth.uid())
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.job_offers
      WHERE job_offers.id = candidatures.job_offer_id
        AND job_offers.recruiter_id = auth.uid()
    )
    OR
    (candidatures.recruiter_id = auth.uid())
  );
