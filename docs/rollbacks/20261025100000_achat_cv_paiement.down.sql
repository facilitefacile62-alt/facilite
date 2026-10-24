-- Annulation de 20261025100000_achat_cv_paiement.sql (à passer par un fichier, jamais dans l'éditeur du dashboard).
-- ATTENTION : supprime le journal des notifications Orange des achats de CV.
DROP FUNCTION IF EXISTS public.preparer_achat_cv(UUID, UUID, TEXT);
DROP TABLE IF EXISTS public.cv_achat_webhook_events;
DROP INDEX IF EXISTS public.cv_achats_un_pending;
