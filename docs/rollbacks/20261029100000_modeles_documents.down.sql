-- Retour arrière de 20261029100000_modeles_documents.sql : supprime le catalogue (les stories éventuellement créées avec lui restent, elles ont leur propre page).
-- Les fichiers du bucket « modeles-documents » doivent être vidés avant de le supprimer (Storage ne le permet pas autrement).
DROP TABLE IF EXISTS public.modeles_documents;
DELETE FROM storage.buckets WHERE id = 'modeles-documents' AND NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'modeles-documents');
