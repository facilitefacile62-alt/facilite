-- Script de migration SQL pour la Messagerie Admin <-> Candidats / Recruteurs
-- Execute ce script dans l'éditeur SQL de votre projet Supabase.

-- 1. Table public.conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_pair UNIQUE (user_1_id, user_2_id)
);

-- Index de performance pour charger rapidement les conversations d'un utilisateur
CREATE INDEX IF NOT EXISTS idx_conversations_user1 ON public.conversations(user_1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user2 ON public.conversations(user_2_id);

-- 2. Activer RLS sur public.conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture conversations admin et participants" ON public.conversations;
DROP POLICY IF EXISTS "Ecriture conversations admin et participants" ON public.conversations;

-- L'admin ou les participants de la conversation peuvent lire
CREATE POLICY "Lecture conversations admin et participants" ON public.conversations
  FOR SELECT
  TO authenticated
  USING (
    user_1_id = auth.uid() OR
    user_2_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- L'admin ou les participants peuvent créer / mettre à jour
CREATE POLICY "Ecriture conversations admin et participants" ON public.conversations
  FOR ALL
  TO authenticated
  USING (
    user_1_id = auth.uid() OR
    user_2_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    user_1_id = auth.uid() OR
    user_2_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );


-- 3. Mise à jour de la table public.messages (s'assurer des colonnes conversation_id et is_read)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'conversation_id'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'is_read'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN is_read BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Index sur conversation_id pour accélération Realtime et jointures
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);

-- 4. Activer RLS sur public.messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture messages admin et participants" ON public.messages;
DROP POLICY IF EXISTS "Insertion messages admin et participants" ON public.messages;

CREATE POLICY "Lecture messages admin et participants" ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    sender_id = auth.uid() OR
    receiver_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id AND (c.user_1_id = auth.uid() OR c.user_2_id = auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Insertion messages admin et participants" ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Mise a jour messages admin et destinataires" ON public.messages
  FOR UPDATE
  TO authenticated
  USING (
    receiver_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Active la réplication temps réel Supabase sur messages et conversations
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
