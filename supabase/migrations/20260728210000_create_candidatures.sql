-- =====================================================================
-- Table public.candidatures (Historique des candidatures rapides)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.candidatures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  job_id INT NOT NULL,
  job_title TEXT NOT NULL,
  company TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  cv_url TEXT NOT NULL,
  cover_letter TEXT,
  status TEXT DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Activation de la sécurité RLS
ALTER TABLE public.candidatures ENABLE ROW LEVEL SECURITY;

-- Politiques RLS
DROP POLICY IF EXISTS "Lecture de ses propres candidatures" ON public.candidatures;
DROP POLICY IF EXISTS "Creation de ses propres candidatures" ON public.candidatures;

CREATE POLICY "Lecture de ses propres candidatures" ON public.candidatures
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Creation de ses propres candidatures" ON public.candidatures
  FOR INSERT WITH CHECK (auth.uid() = user_id);
