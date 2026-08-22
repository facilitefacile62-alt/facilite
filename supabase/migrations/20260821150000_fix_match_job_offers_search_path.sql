-- Bug de production trouvé en testant le point 4 (offres recommandées) :
-- match_job_offers() échoue systématiquement quand appelée via PostgREST
-- avec "operator does not exist: extensions.vector <=> extensions.vector"
-- (reproduit à l'identique en SQL direct, hors PostgREST). Cause : sa
-- définition LIVE en production a `SET search_path TO 'public', 'pg_temp'`
-- — 'extensions' (schéma où vivent le type vector et l'opérateur <=>,
-- pgvector 0.8.2) en a disparu, contrairement à sa jumelle match_resumes()
-- qui a bien 'public', 'extensions', 'pg_temp'. Écart constaté entre les
-- deux définitions live (probablement une passe de durcissement
-- search_path appliquée à l'une sans tenir compte de sa dépendance à
-- extensions, l'autre ayant été réécrite séparément avec SECURITY DEFINER
-- et de vraies conditions d'autorisation). Ce n'était pas visible dans le
-- fichier de migration d'origine (20260730100000_ai_infrastructure.sql),
-- qui a bien 'public, extensions' pour les deux fonctions — la dérive a eu
-- lieu après coup, en production uniquement.
--
-- Conséquence réelle avant ce correctif : la recherche sémantique
-- candidat existante (/offres, OffresClient.jsx) était déjà cassée en
-- production pour quiconque l'utilisait — pas seulement le nouveau point 4.
--
-- Corrige uniquement le search_path, aucun autre changement de logique.
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
SET search_path = public, extensions, pg_temp
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
