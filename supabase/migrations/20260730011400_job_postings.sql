-- Migration pour l'Espace Recruteur : création des tables job_postings et candidatures si elles n'existent pas encore.

CREATE TABLE IF NOT EXISTS public.job_postings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recruiter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  contract_type TEXT NOT NULL DEFAULT 'CDI',
  location TEXT NOT NULL DEFAULT 'Dakar, Sénégal',
  description TEXT NOT NULL,
  skills TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_postings_recruiter ON public.job_postings (recruiter_id, created_at);

ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Les recruteurs gerent leurs offres" ON public.job_postings;
CREATE POLICY "Les recruteurs gerent leurs offres" ON public.job_postings
  FOR ALL USING (auth.uid() = recruiter_id) WITH CHECK (auth.uid() = recruiter_id);

DROP POLICY IF EXISTS "Tout le monde peut voir les offres actives" ON public.job_postings;
CREATE POLICY "Tout le monde peut voir les offres actives" ON public.job_postings
  FOR SELECT USING (true);
