-- Historique persistant de la discussion avec l'assistant IA épinglé.
--
-- La tentative précédente réutilisait public.messages avec un UUID de "bot"
-- factice (00000000-0000-0000-0000-000000000000) comme sender_id/receiver_id.
-- Ça ne peut pas fonctionner : messages.receiver_id référence auth.users(id)
-- (violation de clé étrangère, ce faux UUID n'existe pas), et la policy RLS
-- d'INSERT sur messages exige sender_id = auth.uid() (violation RLS dès que
-- le rôle inséré est "assistant", puisque le client authentifié est toujours
-- l'utilisateur réel, jamais le bot).
--
-- Ici, chaque ligne — qu'elle soit du rôle "user" ou "assistant" — appartient
-- à l'utilisateur authentifié (c'est son historique personnel, pas un échange
-- entre deux comptes distincts). Pas besoin de faux compte bot : la policy
-- RLS se contente de vérifier user_id = auth.uid(), quel que soit le rôle.

CREATE TABLE IF NOT EXISTS public.assistant_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assistant_messages_user_created
  ON public.assistant_messages (user_id, created_at);

ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Un utilisateur gere uniquement son historique IA" ON public.assistant_messages;
CREATE POLICY "Un utilisateur gere uniquement son historique IA" ON public.assistant_messages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
