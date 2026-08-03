-- =====================================================================
-- VAGUE 2 (Partie 1 du chantier) — révoque DELETE de authenticated.
-- Prérequis appliqué séparément (20260802220000) : delete_own_resume(),
-- archive_own_job_offer(), clear_own_assistant_messages() remplacent les 3
-- .delete() client trouvés par recherche exhaustive. Voir
-- docs/grants-matrix.md — aucun autre impact attendu.
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
    EXECUTE format('REVOKE DELETE ON public.%I FROM authenticated', t);
  END LOOP;
END $$;
