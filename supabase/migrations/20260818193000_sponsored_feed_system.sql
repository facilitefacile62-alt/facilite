-- ==============================================================================
-- MIGRATION : Système d'Offres Sponsorisées & Idempotence des Webhooks
-- ==============================================================================

ALTER TABLE public.job_offers
ADD COLUMN IF NOT EXISTS is_sponsored BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sponsored_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sponsor_priority INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_job_offers_sponsored_active
ON public.job_offers (is_sponsored, sponsor_priority DESC, sponsored_until, created_at DESC)
WHERE is_active = true AND status = 'approved';

CREATE INDEX IF NOT EXISTS idx_job_offers_standard_feed
ON public.job_offers (created_at DESC)
WHERE is_active = true AND status = 'approved';

CREATE TABLE IF NOT EXISTS public.processed_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'processed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_provider_event UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_processed_webhooks_lookup
ON public.processed_webhooks (provider, event_id);
