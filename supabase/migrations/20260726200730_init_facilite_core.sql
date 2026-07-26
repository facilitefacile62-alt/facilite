-- Migration Officielle Facilité - Cœur de l'application
-- Date: 2026-07-26
-- Description: Suppression des éléments hors-sujet et consolidation du schéma CV, Utilisateurs & Candidatures

-- Nettoyage des tables hors-projet
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.company_settings CASCADE;

-- 1. TABLE DES CVS (Création & Importation avec Score ATS)
CREATE TABLE IF NOT EXISTS public.resumes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT DEFAULT 'created', -- 'created' ou 'imported'
  content JSONB DEFAULT '{}'::jsonb NOT NULL,
  file_url TEXT,
  ats_score INT DEFAULT 95,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABLE DES CANDIDATURES SPONTANÉES & RECRUTEMENT
CREATE TABLE IF NOT EXISTS public.applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  cv_url TEXT,
  cover_letter TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. POLITIQUES DE SÉCURITÉ RLS
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User resumes policy" ON public.resumes;
CREATE POLICY "User resumes policy" ON public.resumes FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Anyone can submit an application" ON public.applications;
CREATE POLICY "Anyone can submit an application" ON public.applications FOR INSERT WITH CHECK (true);
