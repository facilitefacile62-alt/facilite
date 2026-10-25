-- Profil — rubriques issues du CV (langues, expériences, formation, compétences, centres d'intérêt) : un nouveau CV ne remplace JAMAIS ces rubriques en
-- silence, et l'ancienne version reste récupérable.
--
--  - profil_cv_versions : une copie des cinq rubriques, prise juste AVANT chaque remplacement (par un nouveau CV ou par une restauration). Lecture par
--    la personne seulement ; aucune écriture directe (invariant 1) : tout passe par les deux fonctions ci-dessous. Les 10 plus récentes sont gardées.
--  - profiles.rubriques_cv_le : date de la dernière mise à jour des rubriques à partir d'un CV (écrite seulement par ces fonctions).
--  - appliquer_rubriques_cv() : sauvegarde l'état actuel PUIS écrit les rubriques du CV, dans une seule transaction. Une rubrique que le nouveau CV
--    ne contient pas (liste vide) garde sa valeur : jamais d'effacement par une extraction qui n'a rien trouvé.
--  - restaurer_version_cv() : remet une ancienne version (après avoir sauvegardé l'état actuel, la restauration est donc elle aussi annulable).
--
-- Valeurs « par défaut » : les colonnes languages et skills portent des valeurs par défaut d'exemple (« Français — Principal / Courant », « Gestion de
-- projet / Développement Web / Stratégie Digitale ») que 479 profils sur 533 n'ont jamais changées. Elles ne sont PAS des données de la personne : un état
-- qui ne contient qu'elles est considéré comme vide (rien à sauvegarder).

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rubriques_cv_le TIMESTAMPTZ;
GRANT SELECT (rubriques_cv_le) ON public.profiles TO authenticated;

CREATE TABLE IF NOT EXISTS public.profil_cv_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  motif TEXT NOT NULL CHECK (motif IN ('avant_scan', 'avant_restauration')),
  languages JSONB NOT NULL DEFAULT '[]'::jsonb,
  experiences JSONB NOT NULL DEFAULT '[]'::jsonb,
  educations JSONB NOT NULL DEFAULT '[]'::jsonb,
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  interests JSONB NOT NULL DEFAULT '[]'::jsonb
);
ALTER TABLE public.profil_cv_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profil_cv_versions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profil_cv_versions TO authenticated;
DROP POLICY IF EXISTS "Une personne lit ses anciennes versions de CV" ON public.profil_cv_versions;
CREATE POLICY "Une personne lit ses anciennes versions de CV" ON public.profil_cv_versions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS profil_cv_versions_utilisateur ON public.profil_cv_versions (user_id, created_at DESC);

-- Vrai si les cinq rubriques ne contiennent rien de la personne (vides, ou seulement les valeurs par défaut d'exemple).
CREATE OR REPLACE FUNCTION public.rubriques_cv_vides(p_languages JSONB, p_experiences JSONB, p_educations JSONB, p_skills JSONB, p_interests JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT COALESCE(p_languages, '[]'::jsonb) IN ('[]'::jsonb, '[{"name": "Français", "level": "Principal / Courant"}]'::jsonb, '[{"name": "", "level": ""}]'::jsonb)
     AND COALESCE(p_experiences, '[]'::jsonb) = '[]'::jsonb
     AND COALESCE(p_educations, '[]'::jsonb) = '[]'::jsonb
     AND COALESCE(p_skills, '[]'::jsonb) IN ('[]'::jsonb, '["Gestion de projet", "Développement Web", "Stratégie Digitale"]'::jsonb)
     AND COALESCE(p_interests, '[]'::jsonb) = '[]'::jsonb;
$$;
REVOKE ALL ON FUNCTION public.rubriques_cv_vides(JSONB, JSONB, JSONB, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rubriques_cv_vides(JSONB, JSONB, JSONB, JSONB, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.appliquer_rubriques_cv(p_languages JSONB, p_experiences JSONB, p_educations JSONB, p_skills JSONB, p_interests JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_cur public.profiles%ROWTYPE;
  v_version UUID;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;
  IF jsonb_typeof(p_languages) IS DISTINCT FROM 'array' OR jsonb_typeof(p_experiences) IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_educations) IS DISTINCT FROM 'array' OR jsonb_typeof(p_skills) IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_interests) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Les rubriques doivent être des listes.';
  END IF;
  IF jsonb_array_length(p_languages) > 50 OR jsonb_array_length(p_experiences) > 50 OR jsonb_array_length(p_educations) > 50
     OR jsonb_array_length(p_skills) > 100 OR jsonb_array_length(p_interests) > 50 THEN
    RAISE EXCEPTION 'Trop d''éléments dans une rubrique.';
  END IF;

  SELECT * INTO v_cur FROM public.profiles WHERE id = v_moi FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil introuvable.';
  END IF;

  -- Sauvegarde AVANT de remplacer (rien à sauvegarder si la personne n'avait encore rien de réel).
  IF NOT public.rubriques_cv_vides(v_cur.languages, v_cur.experiences, v_cur.educations, v_cur.skills, v_cur.interests) THEN
    INSERT INTO public.profil_cv_versions (user_id, motif, languages, experiences, educations, skills, interests)
    VALUES (v_moi, 'avant_scan', COALESCE(v_cur.languages, '[]'::jsonb), COALESCE(v_cur.experiences, '[]'::jsonb), COALESCE(v_cur.educations, '[]'::jsonb),
            COALESCE(v_cur.skills, '[]'::jsonb), COALESCE(v_cur.interests, '[]'::jsonb))
    RETURNING id INTO v_version;
  END IF;

  UPDATE public.profiles SET
    languages = CASE WHEN jsonb_array_length(p_languages) > 0 THEN p_languages ELSE languages END,
    experiences = CASE WHEN jsonb_array_length(p_experiences) > 0 THEN p_experiences ELSE experiences END,
    educations = CASE WHEN jsonb_array_length(p_educations) > 0 THEN p_educations ELSE educations END,
    skills = CASE WHEN jsonb_array_length(p_skills) > 0 THEN p_skills ELSE skills END,
    interests = CASE WHEN jsonb_array_length(p_interests) > 0 THEN p_interests ELSE interests END,
    rubriques_cv_le = now(),
    updated_at = now()
  WHERE id = v_moi;

  DELETE FROM public.profil_cv_versions
   WHERE user_id = v_moi AND id NOT IN (SELECT id FROM public.profil_cv_versions WHERE user_id = v_moi ORDER BY created_at DESC LIMIT 10);
  RETURN v_version;
END;
$$;
REVOKE ALL ON FUNCTION public.appliquer_rubriques_cv(JSONB, JSONB, JSONB, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.appliquer_rubriques_cv(JSONB, JSONB, JSONB, JSONB, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.restaurer_version_cv(p_version_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_ver public.profil_cv_versions%ROWTYPE;
  v_cur public.profiles%ROWTYPE;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;
  -- La version doit appartenir à la personne : jamais celle d'un autre compte.
  SELECT * INTO v_ver FROM public.profil_cv_versions WHERE id = p_version_id AND user_id = v_moi;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version introuvable.';
  END IF;
  SELECT * INTO v_cur FROM public.profiles WHERE id = v_moi FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil introuvable.';
  END IF;

  IF NOT public.rubriques_cv_vides(v_cur.languages, v_cur.experiences, v_cur.educations, v_cur.skills, v_cur.interests) THEN
    INSERT INTO public.profil_cv_versions (user_id, motif, languages, experiences, educations, skills, interests)
    VALUES (v_moi, 'avant_restauration', COALESCE(v_cur.languages, '[]'::jsonb), COALESCE(v_cur.experiences, '[]'::jsonb), COALESCE(v_cur.educations, '[]'::jsonb),
            COALESCE(v_cur.skills, '[]'::jsonb), COALESCE(v_cur.interests, '[]'::jsonb));
  END IF;

  UPDATE public.profiles SET
    languages = v_ver.languages, experiences = v_ver.experiences, educations = v_ver.educations,
    skills = v_ver.skills, interests = v_ver.interests, rubriques_cv_le = now(), updated_at = now()
  WHERE id = v_moi;

  DELETE FROM public.profil_cv_versions
   WHERE user_id = v_moi AND id NOT IN (SELECT id FROM public.profil_cv_versions WHERE user_id = v_moi ORDER BY created_at DESC LIMIT 10);
END;
$$;
REVOKE ALL ON FUNCTION public.restaurer_version_cv(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restaurer_version_cv(UUID) TO authenticated;
