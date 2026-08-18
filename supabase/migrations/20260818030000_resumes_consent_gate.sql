-- Corrige l'accès admin inconditionnel aux CV des candidats (table +
-- bucket Storage "resumes") : jusqu'ici tout admin lisait tous les CV sans
-- aucune restriction ("Un admin lit tous les CV" / clause is_admin() de
-- "Recruteurs et admins lisent les CV"). Remplacé par
-- can_admin_read_document(), qui exige une demande de consentement
-- approuvée et non expirée pour ce candidat précis (migrations
-- 20260818000000-20260818020000). Noms de policy et rôles conservés à
-- l'identique pour la continuité de l'historique (vérifiés en base avant
-- réécriture : "Un admin lit tous les CV" n'avait aucune clause TO,
-- "Recruteurs et admins lisent les CV" avait TO authenticated).

DROP POLICY IF EXISTS "Un admin lit tous les CV" ON public.resumes;
CREATE POLICY "Un admin lit tous les CV" ON public.resumes
  FOR SELECT USING (public.can_admin_read_document(user_id, auth.uid()));

DROP POLICY IF EXISTS "Recruteurs et admins lisent les CV" ON storage.objects;
CREATE POLICY "Recruteurs et admins lisent les CV" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (
      auth.uid() = owner
      OR public.can_recruiter_read_cv(owner, auth.uid())
      OR public.can_admin_read_document(owner, auth.uid())
    )
  );
