-- Palier 2 de l'accès admin aux profils candidats : demande de consentement
-- avant tout accès aux documents (CV) d'un candidat. Le candidat doit
-- explicitement approuver ou refuser (voir fonctions de la migration
-- 20260818040000) avant qu'un admin puisse lire ses CV — jusqu'ici l'accès
-- était total et inconditionnel (policy "Un admin lit tous les CV" sur
-- public.resumes, sans aucune vérification), corrigé par la migration
-- 20260818030000.

CREATE TABLE public.document_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
  decided_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Une seule demande en attente par paire admin/candidat — évite qu'un admin
-- ne crée plusieurs demandes identiques avant que le candidat ait répondu.
CREATE UNIQUE INDEX idx_document_access_requests_one_pending
  ON public.document_access_requests (admin_id, candidate_id)
  WHERE status = 'pending';

CREATE INDEX idx_document_access_requests_candidate ON public.document_access_requests(candidate_id);
CREATE INDEX idx_document_access_requests_admin ON public.document_access_requests(admin_id);

ALTER TABLE public.document_access_requests ENABLE ROW LEVEL SECURITY;

-- Lecture : le candidat concerné voit ses propres demandes (pour
-- approuver/refuser), tout admin voit l'ensemble (transparence d'audit,
-- même logique que badge_requests — un admin doit pouvoir voir qu'une
-- demande est déjà active avant d'en créer une redondante).
CREATE POLICY "Lecture de ses propres demandes ou par un admin" ON public.document_access_requests
  FOR SELECT USING (candidate_id = auth.uid() OR public.current_user_role() = 'admin');

-- Aucun GRANT INSERT/UPDATE/DELETE direct à authenticated/anon : toute
-- écriture passe par create_document_access_request()/
-- respond_document_access_request() (migration 20260818040000), qui fixent
-- admin_id/candidate_id côté serveur plutôt que de faire confiance au client.
GRANT SELECT ON public.document_access_requests TO authenticated;

-- Empêche la modification des champs identifiants après création — seuls
-- status/decided_at/expires_at doivent bouger (via les fonctions dédiées),
-- jamais qui a demandé/pour qui/pourquoi.
CREATE OR REPLACE FUNCTION public.prevent_document_access_request_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.admin_id IS DISTINCT FROM OLD.admin_id
     OR NEW.candidate_id IS DISTINCT FROM OLD.candidate_id
     OR NEW.reason IS DISTINCT FROM OLD.reason THEN
    RAISE EXCEPTION 'admin_id, candidate_id et reason sont immuables après création.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_document_access_request_tampering
  BEFORE UPDATE ON public.document_access_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_document_access_request_tampering();
