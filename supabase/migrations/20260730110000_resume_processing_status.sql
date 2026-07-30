-- Statut de traitement d'un CV (upload -> extraction texte -> embedding) et
-- prérequis Realtime pour que /profil puisse refléter ce statut en direct.
--
-- DEFAULT 'completed' plutôt que 'processing' : les lignes déjà existantes
-- (et les flux d'insertion qui ne renseignent jamais `status`, ex.
-- src/app/creer-cv/page.js) n'ont jamais été "en traitement" — les traiter
-- comme terminées évite de les afficher indéfiniment en cours d'analyse.
-- Seul le nouveau flux d'upload dans /profil passe explicitement
-- status: 'processing' à l'insertion.
ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed'
  CHECK (status IN ('processing', 'completed', 'error'));

-- Sans cette ligne, aucun événement postgres_changes ne se déclenche sur
-- cette table (cf. vérifié plus tôt dans cette session pour messages/conversations).
ALTER PUBLICATION supabase_realtime ADD TABLE public.resumes;

-- match_resumes (créée dans 20260730100000_ai_infrastructure.sql) renvoyait
-- resumes.id, mais la CVthèque recruteur (vue candidats_recherche, clé =
-- profiles.id = resumes.user_id) n'a aucun moyen de relier ce résultat à un
-- candidat affiché. On ajoute user_id à la sortie, et on exclut les CV
-- encore en traitement (embedding non fiable/partiel).
DROP FUNCTION IF EXISTS public.match_resumes(extensions.vector, float, int);

CREATE OR REPLACE FUNCTION public.match_resumes (
  query_embedding extensions.vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  candidate_name text,
  similarity float
)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT
    resumes.id,
    resumes.user_id,
    profiles.full_name AS candidate_name,
    1 - (resumes.embedding <=> query_embedding) AS similarity
  FROM public.resumes
  JOIN public.profiles ON profiles.id = resumes.user_id
  WHERE resumes.embedding IS NOT NULL
    AND resumes.status = 'completed'
    AND 1 - (resumes.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
