-- Point d'accès unique et infalsifiable à un document candidat : revérifie
-- indépendamment (jamais confiance dans l'appelant) qu'une demande
-- approuvée et non expirée existe, journalise la consultation, puis
-- renvoie la référence du document demandé. Volontairement inatteignable
-- depuis le navigateur (REVOKE de authenticated ci-dessous) — seul
-- service_role peut l'appeler, exclusivement depuis
-- src/app/api/admin/documents/access/route.js (Phase C). C'est la
-- frontière d'audit du chantier : impossible de consulter un document sans
-- que ce passage journalise l'accès.
CREATE OR REPLACE FUNCTION public.log_document_access(
  p_admin_id uuid,
  p_candidate_id uuid,
  p_document_type text,
  p_resume_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request_id UUID;
  v_result JSONB;
BEGIN
  IF NOT public.can_admin_read_document(p_candidate_id, p_admin_id) THEN
    RAISE EXCEPTION 'Aucune autorisation active pour ce candidat.';
  END IF;

  SELECT r.id INTO v_request_id
  FROM public.document_access_requests r
  WHERE r.candidate_id = p_candidate_id AND r.admin_id = p_admin_id
    AND r.status = 'approved' AND r.expires_at > now()
  ORDER BY r.decided_at DESC
  LIMIT 1;

  INSERT INTO public.document_access_logs (admin_id, candidate_id, request_id, document_type, resume_id)
  VALUES (p_admin_id, p_candidate_id, v_request_id, p_document_type, p_resume_id);

  IF p_document_type IN ('resume_content', 'resume_file') AND p_resume_id IS NOT NULL THEN
    SELECT jsonb_build_object('id', res.id, 'title', res.title, 'content', res.content, 'file_url', res.file_url)
    INTO v_result
    FROM public.resumes res
    WHERE res.id = p_resume_id AND res.user_id = p_candidate_id;
  ELSIF p_document_type = 'profile_cv_file' THEN
    SELECT jsonb_build_object('cv_url', p.cv_url, 'cv_name', p.cv_name)
    INTO v_result
    FROM public.profiles p
    WHERE p.id = p_candidate_id;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.log_document_access(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
