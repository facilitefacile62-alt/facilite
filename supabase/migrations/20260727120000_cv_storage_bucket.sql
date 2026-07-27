-- Bucket de stockage persistant pour les CV et lettres de motivation importés
INSERT INTO storage.buckets (id, name, public)
VALUES ('cvs', 'cvs', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Lecture publique des CV" ON storage.objects;
CREATE POLICY "Lecture publique des CV" ON storage.objects
  FOR SELECT USING (bucket_id = 'cvs');

DROP POLICY IF EXISTS "Upload de son propre CV" ON storage.objects;
CREATE POLICY "Upload de son propre CV" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'cvs' AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Mise a jour de son propre CV" ON storage.objects;
CREATE POLICY "Mise a jour de son propre CV" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'cvs' AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Suppression de son propre CV" ON storage.objects;
CREATE POLICY "Suppression de son propre CV" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'cvs' AND auth.uid()::text = (storage.foldername(name))[1]
  );
