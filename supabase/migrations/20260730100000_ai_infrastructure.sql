-- Infrastructure IA (embeddings + recherche sémantique) pour Facilite.
--
-- Adapté par rapport à la demande initiale sur deux points, le schéma réel
-- ne correspondant pas exactement au script fourni :
--   - Il n'existe pas de table `public.jobs` : les offres vivent dans
--     `public.job_offers` (confirmé via information_schema avant écriture
--     de ce fichier). L'embedding et l'index sont donc portés par
--     `job_offers`.
--   - `public.resumes` n'a pas de colonne `candidate_name` (colonnes
--     réelles : id, user_id, title, type, content jsonb, file_url,
--     ats_score...) : `match_resumes` joint `profiles` sur `resumes.user_id`
--     pour exposer `full_name` sous l'alias `candidate_name`, afin de
--     conserver la forme de résultat demandée sans référencer une colonne
--     inexistante.
--
-- Extensions déjà activées sur ce projet (vérifié via pg_extension) ; les
-- CREATE EXTENSION IF NOT EXISTS restent inclus pour l'idempotence sur un
-- autre environnement (staging, nouveau projet...).
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Colonnes d'embedding vectoriel (768 dimensions : text-embedding-004 côté
-- Gemini, voir supabase/functions/gemini-orchestrator).
ALTER TABLE public.resumes ADD COLUMN IF NOT EXISTS embedding extensions.vector(768);
ALTER TABLE public.job_offers ADD COLUMN IF NOT EXISTS embedding extensions.vector(768);

-- Index HNSW pour accélérer la recherche par similarité cosinus à grande
-- échelle (distance `<=>` de pgvector).
CREATE INDEX IF NOT EXISTS resumes_embedding_idx ON public.resumes USING hnsw (embedding extensions.vector_cosine_ops);
CREATE INDEX IF NOT EXISTS job_offers_embedding_idx ON public.job_offers USING hnsw (embedding extensions.vector_cosine_ops);

-- Matching sémantique (RAG) : CV les plus proches d'un embedding de requête
-- (ex. l'embedding d'une offre, ou d'une recherche recruteur en langage
-- naturel). SECURITY INVOKER (défaut) : respecte la RLS de l'appelant plutôt
-- que de contourner les policies existantes sur `resumes`/`profiles`.
CREATE OR REPLACE FUNCTION public.match_resumes (
  query_embedding extensions.vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  candidate_name text,
  similarity float
)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT
    resumes.id,
    profiles.full_name AS candidate_name,
    1 - (resumes.embedding <=> query_embedding) AS similarity
  FROM public.resumes
  JOIN public.profiles ON profiles.id = resumes.user_id
  WHERE resumes.embedding IS NOT NULL
    AND 1 - (resumes.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- Symétrique côté offres : retrouver les offres les plus proches d'un
-- embedding de CV candidat. Même échelle, même schéma d'appel que
-- `match_resumes`, pour que la même Edge Function orchestre les deux sens.
CREATE OR REPLACE FUNCTION public.match_job_offers (
  query_embedding extensions.vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  title text,
  company text,
  similarity float
)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT
    job_offers.id,
    job_offers.title,
    job_offers.company,
    1 - (job_offers.embedding <=> query_embedding) AS similarity
  FROM public.job_offers
  WHERE job_offers.embedding IS NOT NULL
    AND job_offers.is_active = true
    AND 1 - (job_offers.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
