-- Section 7 du chantier RBAC : reconstruction de candidats_recherche
-- (supprimée en CASCADE par 20260802050000, référençait role='candidat' en
-- dur) et match_resumes (rendue inerte par le même changement, comparait
-- current_user_role() à 'recruteur', valeur qui n'existe plus).
--
-- Nouveau modèle d'autorisation : admin (accès total), ou 'user' avec le
-- badge verified_recruiter (has_badge(), pas une lecture directe de la
-- colonne cosmétique badges — la même fonction que 20260802080000).
-- Nouveau filtre du pool de candidats : exclut les comptes ayant
-- eux-mêmes le badge verified_recruiter (un recruteur accrédité n'a pas de
-- raison d'apparaître dans la recherche d'un autre recruteur) — sous
-- l'ancien modèle, role='candidat' faisait ce tri structurellement ; ce
-- n'est plus possible, tout le monde est 'user'.

DROP VIEW IF EXISTS public.candidats_recherche;
CREATE VIEW public.candidats_recherche
WITH (security_invoker = off) AS
SELECT
  id,
  full_name,
  headline,
  bio,
  city,
  location,
  skills,
  experiences,
  educations,
  avatar_url,
  cv_url,
  cv_name
FROM public.profiles
WHERE NOT public.has_badge(id, 'verified_recruiter')
  AND (
    public.current_user_role() = 'admin'
    OR (public.current_user_role() = 'user' AND public.has_badge(auth.uid(), 'verified_recruiter'))
  );

REVOKE ALL ON public.candidats_recherche FROM PUBLIC;
GRANT SELECT ON public.candidats_recherche TO authenticated;

CREATE OR REPLACE FUNCTION public.match_resumes(query_embedding vector, match_threshold double precision, match_count integer)
RETURNS TABLE(id uuid, user_id uuid, candidate_name text, similarity double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'extensions'
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
    AND NOT public.has_badge(resumes.user_id, 'verified_recruiter')
    AND (
      public.current_user_role() = 'admin'
      OR (public.current_user_role() = 'user' AND public.has_badge(auth.uid(), 'verified_recruiter'))
    )
    AND 1 - (resumes.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
