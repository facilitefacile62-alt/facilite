-- Ajoute les colonnes pour les centres d'intérêt et l'e-mail de contact extraits du CV
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS contact_email TEXT;
