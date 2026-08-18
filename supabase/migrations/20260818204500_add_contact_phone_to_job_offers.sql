-- ==============================================================================
-- MIGRATION : Ajout des colonnes de contact téléphonique et WhatsApp
-- ==============================================================================

ALTER TABLE public.job_offers
ADD COLUMN IF NOT EXISTS contact_phone TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS contact_whatsapp TEXT DEFAULT NULL;

-- Notifier PostgREST pour recharger immédiatement le cache du schéma
NOTIFY pgrst, 'reload schema';
