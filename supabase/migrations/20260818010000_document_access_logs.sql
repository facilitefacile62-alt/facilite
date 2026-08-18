-- Journal d'audit append-only de chaque consultation RÉELLE d'un document
-- candidat par un admin autorisé — distinct de document_access_requests
-- (qui trace la demande/décision, pas la consultation elle-même). Visible
-- par le candidat concerné sur /candidat/securite (nouvelle page, Phase D).
-- Patron strictement identique à security_logs (20260802070000) : ni
-- UPDATE ni DELETE accordés à quiconque, admin compris — un journal
-- modifiable après coup ne prouve rien.

CREATE TABLE public.document_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.document_access_requests(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('resume_content', 'resume_file', 'profile_cv_file')),
  resume_id UUID REFERENCES public.resumes(id) ON DELETE SET NULL,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_access_logs_candidate ON public.document_access_logs(candidate_id);
CREATE INDEX idx_document_access_logs_admin ON public.document_access_logs(admin_id);

ALTER TABLE public.document_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture de son propre journal ou par un admin" ON public.document_access_logs
  FOR SELECT USING (candidate_id = auth.uid() OR public.current_user_role() = 'admin');

-- Écriture réservée à log_document_access() (migration 20260818050000),
-- appelée uniquement via service_role — aucun GRANT INSERT à
-- authenticated/anon. Ni UPDATE ni DELETE à personne, jamais.
GRANT SELECT ON public.document_access_logs TO authenticated;
