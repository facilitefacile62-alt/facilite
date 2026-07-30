-- Migration pour ajouter la colonne image_url à la table job_offers
ALTER TABLE public.job_offers 
ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

-- S'assurer que job_postings l'a aussi si utilisée en doublon
ALTER TABLE public.job_postings 
ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;
