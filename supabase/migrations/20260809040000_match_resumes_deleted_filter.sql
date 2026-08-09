-- =====================================================================
-- match_resumes() (recherche IA par similarité) manquait le filtre
-- deleted_at IS NULL déjà appliqué à get_candidats_recherche() et
-- get_profils_publics() (20260809020000) — un compte en cours de
-- suppression pouvait encore être proposé par similarité vectorielle.
--
-- Trouvé en marge de ce correctif : SET search_path TO 'public', 'pg_temp'
-- ne contient pas 'extensions', où l'extension vector (et son opérateur
-- <=>) est installée sur ce projet — la fonction échouait déjà sur TOUT
-- appel réel en production, avant ce correctif ("operator does not exist:
-- extensions.vector <=> extensions.vector", vérifié directement). Corrigé
-- au passage : sans ça la fonction n'est même pas redéployable.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.match_resumes(query_embedding vector, match_threshold double precision, match_count integer)
RETURNS TABLE(id uuid, user_id uuid, candidate_name text, similarity double precision)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
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
    AND profiles.cv_visible_recruteurs = true
    AND profiles.deleted_at IS NULL
    AND NOT public.has_badge(resumes.user_id, 'verified_recruiter')
    AND profiles.is_test_account = COALESCE(
      (SELECT is_test_account FROM public.profiles caller WHERE caller.id = auth.uid()),
      false
    )
    AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'user' AND public.has_badge(auth.uid(), 'verified_recruiter'))
    )
    AND 1 - (resumes.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
