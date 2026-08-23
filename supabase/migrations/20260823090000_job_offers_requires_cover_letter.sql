-- Point 5 (lot du 2026-08-23) : lettre de motivation obligatoire selon l'offre.
-- Le recruteur coche cette case à la publication ; /api/postuler bloque la
-- candidature si le champ texte cover_letter est vide et que l'offre l'exige.
-- DEFAULT false : toutes les offres existantes restent sans exigence
-- (comportement inchangé tant que le recruteur ne coche pas la case).
ALTER TABLE public.job_offers
  ADD COLUMN IF NOT EXISTS requires_cover_letter BOOLEAN NOT NULL DEFAULT false;
