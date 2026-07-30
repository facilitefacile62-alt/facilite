-- Migration pour le Filtre d'Éligibilité et la Messagerie Séparée

-- 1. Niveau d'étude minimum sur job_offers
ALTER TABLE public.job_offers
ADD COLUMN IF NOT EXISTS min_education_level TEXT DEFAULT 'Aucun';

-- 2. Match Score sur candidatures
ALTER TABLE public.candidatures
ADD COLUMN IF NOT EXISTS cv_match_score INT DEFAULT 0;

-- 3. Type de discussion et référence d'offre sur messages / conversations
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS type_discussion TEXT DEFAULT 'ECHANGE' CHECK (type_discussion IN ('OFFRE', 'ECHANGE')),
ADD COLUMN IF NOT EXISTS job_offer_id UUID REFERENCES public.job_offers(id) ON DELETE SET NULL;

ALTER TABLE public.assistant_messages
ADD COLUMN IF NOT EXISTS type_discussion TEXT DEFAULT 'ECHANGE';
