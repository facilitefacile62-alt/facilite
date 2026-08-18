-- Indicateur de complétude de profil pour le palier 1 (sans consentement)
-- du panneau admin : renvoie des booléens calculés en SQL, jamais le
-- contenu brut des champs (bio/expériences/etc. ne quittent jamais cette
-- fonction). Patron get_users_phone_status() : rôle admin vérifié, RETURN
-- QUERY, appelable en lot sur plusieurs candidats à la fois.
CREATE OR REPLACE FUNCTION public.get_profiles_completeness(p_user_ids uuid[])
RETURNS TABLE(
  user_id uuid,
  has_avatar boolean,
  has_headline boolean,
  has_bio boolean,
  has_phone boolean,
  has_location boolean,
  has_experience boolean,
  has_education boolean,
  has_skills boolean,
  has_cv boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
    jsonb_array_length(COALESCE(p.skills, '[]'::jsonb)) > 0,
    p.cv_url IS NOT NULL OR EXISTS (SELECT 1 FROM public.resumes r WHERE r.user_id = p.id)
  FROM public.profiles p
  WHERE p.id = ANY(p_user_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.get_profiles_completeness(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profiles_completeness(uuid[]) TO authenticated;
