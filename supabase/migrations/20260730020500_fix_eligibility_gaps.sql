-- Corrige des lacunes de la migration précédente (20260730015400) qui
-- empêchaient le filtre d'éligibilité de fonctionner réellement :
--
-- 1. /api/postuler interrogeait profiles.degree, colonne inexistante — le
--    niveau d'étude du candidat retombait donc toujours sur "Aucun", quel
--    que soit son vrai diplôme. Ajout de profiles.education_level (même
--    échelle que job_offers.min_education_level).
-- 2. candidatures.job_id est INT NOT NULL, alors que job_offers.id est un
--    UUID — une candidature à une vraie offre recruteur (via
--    candidatures.job_offer_id, déjà présent depuis 20260730020000) ne peut
--    pas fournir de job_id entier valide. Contrainte assouplie.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS education_level TEXT;

ALTER TABLE public.candidatures
  ALTER COLUMN job_id DROP NOT NULL;
