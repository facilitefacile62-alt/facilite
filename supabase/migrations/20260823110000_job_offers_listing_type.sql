-- Point 4 (2026-08-23) : type de publication (job_offers.listing_type),
-- déterminé automatiquement par le Scanner IA (extractFullJobOfferFromPosterWithGemini,
-- documentParser.js) à chaque publication — offre d'emploi classique
-- distinguée d'un concours, d'une formation, d'un recrutement spontané ou
-- d'un recrutement sur place. DEFAULT 'offre_emploi' : les offres
-- existantes (recruteurs comme catalogue historique) sont très
-- majoritairement de vraies offres d'emploi classiques.
ALTER TABLE public.job_offers
  ADD COLUMN IF NOT EXISTS listing_type TEXT NOT NULL DEFAULT 'offre_emploi';

ALTER TABLE public.job_offers
  DROP CONSTRAINT IF EXISTS job_offers_listing_type_check;

ALTER TABLE public.job_offers
  ADD CONSTRAINT job_offers_listing_type_check
  CHECK (listing_type IN ('offre_emploi', 'concours', 'formation', 'recrutement_spontane', 'travail_sur_place', 'autre'));
