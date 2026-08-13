-- =====================================================================
-- Point 3 du chantier "photos de profil et couverture instables" —
-- correctif suite au point A : /in/[username] (profil public) doit
-- pouvoir générer une URL signée pour l'avatar/couverture d'un AUTRE
-- utilisateur que le visiteur connecté (voire un visiteur anonyme, pas
-- connecté du tout), quand ce profil est publié (is_public = true).
--
-- Les policies posées dans 20260813180000_avatars_covers_policies.sql
-- ne couvraient que le propriétaire et les admins — correct pour
-- profil/page.js (édition privée), insuffisant pour la vitrine
-- publique. Redéfinit les 2 policies SELECT en ajoutant cette
-- troisième condition, sans toucher aux policies d'écriture
-- (INSERT/UPDATE/DELETE restent strictement réservées au propriétaire).
-- =====================================================================

DROP POLICY IF EXISTS "Un utilisateur lit son propre avatar" ON storage.objects;
CREATE POLICY "Un utilisateur lit son propre avatar" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'avatars' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id::text = (storage.foldername(name))[1] AND p.is_public = true
      )
    )
  );

DROP POLICY IF EXISTS "Un utilisateur lit sa propre couverture" ON storage.objects;
CREATE POLICY "Un utilisateur lit sa propre couverture" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'covers' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id::text = (storage.foldername(name))[1] AND p.is_public = true
      )
    )
  );
