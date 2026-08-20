-- check_resume_quota() (20260818080000_resumes_quota_limit_two.sql) comptait
-- TOUTES les lignes resumes du candidat, y compris les CV créés avec
-- l'éditeur intégré (type='created', file_url toujours NULL) — un candidat
-- ayant créé 2 CV à l'éditeur ne pouvait alors plus jamais importer un
-- vrai fichier, alors que la règle produit est "les CV créés à l'éditeur
-- restent illimités, seuls les documents importés (file_url non nul) sont
-- plafonnés à 2". Corrige le comptage et la condition de blocage pour ne
-- porter que sur file_url IS NOT NULL, dans les deux sens : un INSERT avec
-- file_url NULL (CV éditeur) n'est plus jamais bloqué par ce trigger, quel
-- que soit le nombre de documents déjà présents.
--
-- Non rétroactif par construction : ce trigger ne s'applique qu'aux futurs
-- INSERT, aucune ligne existante n'est touchée — un candidat déjà au-dessus
-- de 2 documents importés (comportement observé avant cette migration)
-- conserve ses documents existants et n'est bloqué que pour un nouvel
-- ajout futur.
--
-- SET search_path ajouté par cohérence avec le reste du dépôt (fonction
-- SECURITY INVOKER, pas DEFINER — pas un cas Invariant 3, mais aucune
-- raison de laisser un search_path mutable).

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

  IF doc_count >= 2 THEN
    RAISE EXCEPTION 'Quota atteint : un candidat ne peut pas importer plus de 2 documents (1 CV et 1 lettre de motivation). Les CV créés avec l''éditeur ne sont pas concernés par cette limite.';
  END IF;

  RETURN NEW;
END;
$$;
