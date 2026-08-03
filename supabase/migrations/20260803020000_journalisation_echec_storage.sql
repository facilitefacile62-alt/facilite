-- =====================================================================
-- PARTIE 2, ÉTAPE 3.1 du chantier — journalise un échec de suppression
-- Storage après delete_own_resume() (droit à l'oubli partiellement honoré :
-- ligne supprimée, fichier resté orphelin faute de log, invisible pour un
-- futur nettoyage manuel).
--
-- Fonction étroite (pas un accès direct à log_security_event, réservé à
-- service_role) : force actor_id/target_user_id = auth.uid(), impossible
-- pour l'appelant de spoofer un autre acteur ou un type d'évènement libre.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.log_own_storage_deletion_failure(p_bucket text, p_path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  PERFORM public.log_security_event(
    'storage_deletion_failed', 'warning', auth.uid(), auth.uid(),
    jsonb_build_object('bucket', p_bucket, 'path', p_path)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_own_storage_deletion_failure(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_own_storage_deletion_failure(text, text) TO authenticated;
