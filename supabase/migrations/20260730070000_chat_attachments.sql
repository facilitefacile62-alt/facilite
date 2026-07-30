-- Script de migration SQL pour les pièces jointes (PDF, documents, notes vocales)
-- dans la table public.messages

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'attachment_url'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN attachment_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'attachment_type'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN attachment_type TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'file_name'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN file_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'file_size'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN file_size TEXT;
  END IF;
END $$;

-- Création et configuration du bucket Storage chat-attachments (s'il n'existe pas).
-- Bucket public, à l'image de job-offers déjà en place dans ce projet : les
-- fichiers échangés en chat (docs, notes vocales) sont servis par URL directe
-- plutôt que par URL signée, pour éviter qu'un lien stocké en base n'expire.
-- Contrairement au bucket resumes (privé, CV sensibles), une pièce jointe de
-- chat n'est accessible qu'à qui connaît son chemin (préfixé par l'UUID de
-- l'expéditeur + un timestamp), ce qui est le même modèle de confiance que
-- job-offers.
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Politiques RLS de stockage : lecture publique (nécessaire pour que
-- getPublicUrl() fonctionne), écriture réservée aux utilisateurs authentifiés.
DROP POLICY IF EXISTS "Public select chat-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload chat-attachments" ON storage.objects;

CREATE POLICY "Public select chat-attachments" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'chat-attachments');

CREATE POLICY "Authenticated upload chat-attachments" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-attachments');
