-- Ajoute le type 'document_access' aux notifications autorisées, requis
-- par notify_document_access_request()/notify_document_access_response()
-- (migration 20260818040000).
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('jobs', 'posts', 'mentions', 'candidature', 'reponse', 'badge', 'message', 'system', 'document_access'));
