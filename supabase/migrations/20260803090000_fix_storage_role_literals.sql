-- Étape A du chantier (2026-08-03) : les 2 policies Storage trouvées par
-- docs/diagnostic-2026-08.md référençaient encore le littéral 'recruteur',
-- un rôle qui n'existe plus depuis 20260802050000_rbac_user_roles.sql
-- (candidat/recruteur fusionnés dans 'user', distingués par badge). Un scan
-- exhaustif (pg_policies, pg_proc, pg_constraint) confirme que ce sont les
-- SEULES occurrences restantes côté base — voir le rapport du chantier pour
-- le détail. Réécrites sur le même motif que get_candidats_recherche()
-- (20260802120000) : admin OU (user + badge verified_recruiter).

DROP POLICY IF EXISTS "Recruteurs et admins lisent les CV" ON storage.objects;
CREATE POLICY "Recruteurs et admins lisent les CV"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (
      current_user_role() = 'admin'
      OR (current_user_role() = 'user' AND has_badge(auth.uid(), 'verified_recruiter'))
    )
  );

DROP POLICY IF EXISTS "Un recruteur televerse ses visuels d'offres" ON storage.objects;
CREATE POLICY "Un recruteur televerse ses visuels d'offres"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'job-offers'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (
      current_user_role() = 'admin'
      OR (current_user_role() = 'user' AND has_badge(auth.uid(), 'verified_recruiter'))
    )
  );
