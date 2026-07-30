-- Migration SQL pour la lecture publique universelle des offres d'emploi (job_offers)
-- Assure la visibilité par tous les candidats (authentifiés ou anonymes)
--
-- Le volet "job_postings" a été retiré : cette table était un doublon de
-- job_offers créé par erreur puis supprimé (voir commit
-- "chore: retire une migration redondante/cassée"). La référencer ici ferait
-- échouer tout rejeu de cette migration (ALTER TABLE sur une relation
-- inexistante) sur une base où job_postings n'a jamais existé.

ALTER TABLE public.job_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public select job_offers" ON public.job_offers;
DROP POLICY IF EXISTS "Tout le monde peut voir les offres" ON public.job_offers;
DROP POLICY IF EXISTS "Lecture publique des offres" ON public.job_offers;

CREATE POLICY "Lecture publique des offres" ON public.job_offers
  FOR SELECT
  TO public
  USING (true);
