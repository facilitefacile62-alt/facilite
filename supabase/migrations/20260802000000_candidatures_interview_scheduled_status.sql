-- Ajoute 'interview_scheduled' au CHECK existant (20260730140000, qui
-- avait déjà 'reviewed' pour "vu par le recruteur"). Découvert en testant
-- l'auto-transition de statut au démarrage d'un entretien vidéo : la
-- tentative échouait silencieusement côté route (erreur PostgREST 23514
-- avalée par le try/catch best-effort), jamais remarqué sans ce test
-- empirique.
ALTER TABLE public.candidatures DROP CONSTRAINT IF EXISTS candidatures_status_check;
ALTER TABLE public.candidatures ADD CONSTRAINT candidatures_status_check
  CHECK (status IN ('pending', 'reviewed', 'interview_scheduled', 'accepted', 'rejected'));
