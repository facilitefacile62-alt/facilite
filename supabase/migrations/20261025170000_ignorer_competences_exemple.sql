-- Ignorer les compétences d'EXEMPLE (sans toucher aux données) dans la recherche de candidats et le calcul de complétude.
--
-- Contexte : jusqu'au 25/10/2026, la valeur par défaut de profiles.skills était la liste d'exemple « Gestion de projet / Développement Web / Stratégie Digitale »
-- (voir 20261025150000). Le nettoyage (20261025160000) n'a vidé que les profils jamais modifiés depuis leur création ; 62 profils modifiés plus tard portent
-- encore cette liste. On ne change PAS leurs données (on ne sait pas s'ils l'ont gardée volontairement) : on l'ignore là où elle faussait un résultat.
--
-- Règle STRICTE, identique à src/lib/valeursExemple.js : seule la liste EXACTE (ces trois textes, dans cet ordre, rien d'autre) est ignorée. Une vraie compétence
-- « Gestion de projet » saisie seule, ou avec d'autres compétences, n'est jamais ignorée.
--
--  - competences_reelles(jsonb) : la liste, ou une liste vide si c'est exactement l'exemple.
--  - get_candidats_recherche() : renvoie les compétences « réelles » (même signature, mêmes droits : CREATE OR REPLACE ne change pas les droits existants).
--  - get_profiles_completeness() : « a des compétences » ne compte plus la liste d'exemple.

CREATE OR REPLACE FUNCTION public.competences_reelles(p_skills JSONB)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE WHEN p_skills = '["Gestion de projet", "Développement Web", "Stratégie Digitale"]'::jsonb THEN '[]'::jsonb ELSE p_skills END;
$$;
REVOKE ALL ON FUNCTION public.competences_reelles(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.competences_reelles(JSONB) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_candidats_recherche()
RETURNS TABLE(id uuid, full_name text, headline text, bio text, city text, location text, skills jsonb, experiences jsonb, educations jsonb, avatar_url text, cv_url text, cv_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
SELECT
  id, full_name, headline, bio, city, location, public.competences_reelles(skills), experiences,
  educations, avatar_url, cv_url, cv_name
FROM public.profiles
WHERE cv_visible_recruteurs = true
  AND deleted_at IS NULL
  AND NOT public.has_badge(id, 'verified_recruiter')
  AND is_test_account = COALESCE(
    (SELECT is_test_account FROM public.profiles caller WHERE caller.id = auth.uid()),
    false
  )
  AND (
    public.current_user_role() = 'admin'
    OR (public.current_user_role() = 'user' AND public.has_badge(auth.uid(), 'verified_recruiter'))
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_profiles_completeness(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, has_avatar boolean, has_headline boolean, has_bio boolean, has_phone boolean, has_location boolean, has_experience boolean, has_education boolean, has_skills boolean, has_cv boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs.';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.avatar_url IS NOT NULL,
    p.headline IS NOT NULL AND length(trim(p.headline)) > 0,
    p.bio IS NOT NULL AND length(trim(p.bio)) > 0,
    p.phone IS NOT NULL AND length(trim(p.phone)) > 0,
    (p.city IS NOT NULL AND length(trim(p.city)) > 0) OR (p.country IS NOT NULL AND length(trim(p.country)) > 0),
    jsonb_array_length(COALESCE(p.experiences, '[]'::jsonb)) > 0,
    jsonb_array_length(COALESCE(p.educations, '[]'::jsonb)) > 0,
    jsonb_array_length(COALESCE(public.competences_reelles(p.skills), '[]'::jsonb)) > 0,
    p.cv_url IS NOT NULL OR EXISTS (SELECT 1 FROM public.resumes r WHERE r.user_id = p.id)
  FROM public.profiles p
  WHERE p.id = ANY(p_user_ids);
END;
$function$;
