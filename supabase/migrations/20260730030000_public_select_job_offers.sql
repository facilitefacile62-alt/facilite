-- Migration SQL pour la lecture publique universelle des offres d'emploi (job_offers et job_postings)
-- Assure la visibilité par tous les candidats (authentifiés ou anonymes)

-- 1. Table job_offers
ALTER TABLE public.job_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public select job_offers" ON public.job_offers;
DROP POLICY IF EXISTS "Tout le monde peut voir les offres" ON public.job_offers;
DROP POLICY IF EXISTS "Lecture publique des offres" ON public.job_offers;

CREATE POLICY "Lecture publique des offres" ON public.job_offers
  FOR SELECT
  TO public
  USING (true);

-- 2. Table job_postings (si utilisée en miroir)
ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public select job_postings" ON public.job_postings;
DROP POLICY IF EXISTS "Lecture publique des postings" ON public.job_postings;

CREATE POLICY "Lecture publique des postings" ON public.job_postings
  FOR SELECT
  TO public
  USING (true);
