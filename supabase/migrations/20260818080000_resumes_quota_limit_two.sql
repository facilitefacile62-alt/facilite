-- Migration: Limite stricte de 2 documents maximum conservés par candidat (CV + Lettre de motivation)
-- Description: Déclencheur PostgreSQL empêchant l'insertion d'un 3ème document pour un même utilisateur

CREATE OR REPLACE FUNCTION check_resume_quota()
RETURNS TRIGGER AS $$
DECLARE
  doc_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO doc_count FROM public.resumes WHERE user_id = NEW.user_id;
  IF doc_count >= 2 THEN
    RAISE EXCEPTION 'Quota atteint : un candidat ne peut pas conserver plus de 2 documents (1 CV et 1 lettre de motivation).';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_resume_quota ON public.resumes;
CREATE TRIGGER trg_check_resume_quota
BEFORE INSERT ON public.resumes
FOR EACH ROW
EXECUTE FUNCTION check_resume_quota();
