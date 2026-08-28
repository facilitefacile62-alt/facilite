-- Relever le quota de documents importés par candidat de 2 à 5.
-- Permet aux candidats de conserver plusieurs CVs (ex: CV standard, CV anglais, CV canadien)
-- et lettres de motivation sans être artificiellement bloqués à « Max atteint ».

CREATE OR REPLACE FUNCTION public.check_resume_quota()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  doc_count INTEGER;
BEGIN
  IF NEW.file_url IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO doc_count FROM public.resumes
  WHERE user_id = NEW.user_id AND file_url IS NOT NULL;

  IF doc_count >= 5 THEN
    RAISE EXCEPTION 'Quota atteint : un candidat ne peut pas importer plus de 5 documents (CVs, lettres de motivation, attestations). Les CV créés avec l''éditeur ne sont pas concernés par cette limite.';
  END IF;

  RETURN NEW;
END;
$$;
