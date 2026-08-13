-- =====================================================================
-- Point 3 du chantier "photos de profil et couverture instables" —
-- étape 5/8 : policies RLS Storage sur les buckets avatars/covers créés
-- dans 20260813170000_avatars_covers_buckets.sql.
--
-- Convention de chemin : {user_id}/avatar.jpg ou {user_id}/cover.jpg —
-- storage.foldername(name))[1] est donc le user_id propriétaire, même
-- schéma que resumes/chat-attachments déjà en place dans ce projet.
-- =====================================================================

DROP POLICY IF EXISTS "Un utilisateur lit son propre avatar" ON storage.objects;
CREATE POLICY "Un utilisateur lit son propre avatar" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'avatars' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Un utilisateur ecrit son propre avatar" ON storage.objects;
CREATE POLICY "Un utilisateur ecrit son propre avatar" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Un utilisateur remplace son propre avatar" ON storage.objects;
CREATE POLICY "Un utilisateur remplace son propre avatar" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Un utilisateur supprime son propre avatar" ON storage.objects;
CREATE POLICY "Un utilisateur supprime son propre avatar" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Un utilisateur lit sa propre couverture" ON storage.objects;
CREATE POLICY "Un utilisateur lit sa propre couverture" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'covers' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Un utilisateur ecrit sa propre couverture" ON storage.objects;
CREATE POLICY "Un utilisateur ecrit sa propre couverture" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'covers' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Un utilisateur remplace sa propre couverture" ON storage.objects;
CREATE POLICY "Un utilisateur remplace sa propre couverture" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'covers' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'covers' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Un utilisateur supprime sa propre couverture" ON storage.objects;
CREATE POLICY "Un utilisateur supprime sa propre couverture" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'covers' AND (storage.foldername(name))[1] = auth.uid()::text);
