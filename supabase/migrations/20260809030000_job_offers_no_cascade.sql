-- =====================================================================
-- Retour sur job_offers.recruiter_id ON DELETE CASCADE (20260809020000) :
-- les candidatures reçues sur ces offres appartiennent à de vrais
-- candidats — supprimer l'offre casserait leur historique ("à quoi ai-je
-- postulé ?"). Dépublie au lieu de supprimer (voir purge-deleted-accounts/
-- route.js, qui archive explicitement AVANT deleteUser()) : archived_at +
-- is_active=false, exactement la convention déjà utilisée par
-- archive_own_job_offer() — pas de nouvelle valeur de status (la colonne a
-- une contrainte CHECK qui n'inclut pas 'archived').
--
-- ON DELETE SET NULL en filet de sécurité : recruiter_id est nullable,
-- donc même si l'archivage explicite était un jour sauté, la ligne
-- survivrait quand même plutôt que d'être supprimée en cascade.
-- =====================================================================

ALTER TABLE public.job_offers DROP CONSTRAINT job_offers_recruiter_id_fkey;
ALTER TABLE public.job_offers ADD CONSTRAINT job_offers_recruiter_id_fkey
  FOREIGN KEY (recruiter_id) REFERENCES auth.users(id) ON DELETE SET NULL;
