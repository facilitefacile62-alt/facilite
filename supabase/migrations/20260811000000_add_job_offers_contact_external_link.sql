-- Migration: Add contact_email and external_link to job_offers

ALTER TABLE public.job_offers
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS external_link TEXT;

GRANT UPDATE (contact_email, external_link) ON public.job_offers TO authenticated;
