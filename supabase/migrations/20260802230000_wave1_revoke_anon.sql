-- =====================================================================
-- VAGUE 1 (Partie 1 du chantier) — révoque UPDATE/DELETE de anon sur les
-- tables où c'est aujourd'hui accordé sans justification. Voir
-- docs/grants-matrix.md. Aucun impact fonctionnel attendu : un visiteur
-- non connecté n'a besoin que de SELECT sur les données publiques.
-- =====================================================================
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'agent_assignments','ai_usage_daily','applications','assistant_messages',
    'candidatures','contact_messages','conversations','interviews',
    'job_offers','messages','orders','profiles','recruiter_profiles',
    'resumes','subscriptions','support_threads','transactions'
  ])
  LOOP
    EXECUTE format('REVOKE UPDATE, DELETE ON public.%I FROM anon', t);
  END LOOP;
END $$;
