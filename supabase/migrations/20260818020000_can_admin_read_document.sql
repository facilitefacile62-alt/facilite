-- Fonction d'autorisation centrale du chantier "accès admin aux documents
-- candidats" : vérifie qu'une demande approuvée et non expirée existe pour
-- CETTE paire admin/candidat précise. Même forme que can_recruiter_read_cv
-- (SECURITY DEFINER, search_path figé, un seul SELECT EXISTS). Utilisée à
-- la fois par les policies RLS (migration 20260818030000) et par
-- log_document_access() (migration 20260818050000), qui revérifie
-- indépendamment avant de journaliser — jamais de confiance aveugle dans
-- l'appelant.
CREATE OR REPLACE FUNCTION public.can_admin_read_document(p_candidate_id uuid, p_admin_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.document_access_requests r
    WHERE r.candidate_id = p_candidate_id
      AND r.admin_id = p_admin_id
      AND r.status = 'approved'
      AND r.expires_at > now()
  );
$$;
