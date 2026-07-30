-- Lien entre candidatures et job_offers, pour que l'onglet "Candidatures
-- reçues" du dashboard recruteur puisse afficher les candidatures liées à
-- ses propres offres publiées.
--
-- Contexte : candidatures.job_id (INT) référence les offres statiques de la
-- page d'accueil (flux "postuler rapide" existant, /api/postuler), pas les
-- offres publiées par les recruteurs via /recruteur (job_offers.id, UUID).
-- Les deux systèmes sont aujourd'hui indépendants. Cette colonne, nullable
-- et additive, prépare le terrain pour qu'un futur flux de candidature sur
-- une offre recruteur (job_offers) puisse s'y rattacher, sans rien casser
-- de l'existant.

ALTER TABLE public.candidatures
  ADD COLUMN IF NOT EXISTS job_offer_id UUID REFERENCES public.job_offers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_candidatures_job_offer_id ON public.candidatures(job_offer_id);

-- Un recruteur peut lire les candidatures rattachées à SES offres.
DROP POLICY IF EXISTS "Un recruteur lit les candidatures de ses offres" ON public.candidatures;
CREATE POLICY "Un recruteur lit les candidatures de ses offres" ON public.candidatures
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.job_offers
      WHERE job_offers.id = candidatures.job_offer_id
        AND job_offers.recruiter_id = auth.uid()
    )
  );

-- ... et changer leur statut (En attente / Accepté / Refusé), rien d'autre :
-- pas de modification du contenu (cv_url, cover_letter...) d'une
-- candidature qui ne lui appartient pas.
DROP POLICY IF EXISTS "Un recruteur met a jour le statut de ses candidatures" ON public.candidatures;
CREATE POLICY "Un recruteur met a jour le statut de ses candidatures" ON public.candidatures
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.job_offers
      WHERE job_offers.id = candidatures.job_offer_id
        AND job_offers.recruiter_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.job_offers
      WHERE job_offers.id = candidatures.job_offer_id
        AND job_offers.recruiter_id = auth.uid()
    )
  );
