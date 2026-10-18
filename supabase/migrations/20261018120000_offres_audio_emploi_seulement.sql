-- L'audio d'une offre ne concerne, pour le moment, que les OFFRES D'EMPLOI.
--
-- 20261018100000 a ajouté job_offers.audio_url pour toutes les annonces. Décision du propriétaire
-- (18/10/2026) : l'audio est réservé aux offres d'emploi (listing_type = 'offre_emploi') ; concours,
-- formations, recrutements spontanés, travail sur place et autres annonces n'en ont pas, pour le moment.
-- Les formulaires et les lecteurs le respectent déjà ; cette contrainte l'impose aussi à la base, même
-- pour un appel direct. Aucune offre n'a d'audio à ce jour (colonne créée le jour même, aucune ligne
-- concernée), la contrainte s'applique donc sans rien casser.

ALTER TABLE public.job_offers DROP CONSTRAINT IF EXISTS job_offers_audio_emploi_seulement;
ALTER TABLE public.job_offers
  ADD CONSTRAINT job_offers_audio_emploi_seulement
  CHECK (audio_url IS NULL OR listing_type = 'offre_emploi');
