-- Ajoute le support de plusieurs fils de discussion IA par utilisateur
-- (bouton "Nouvelle discussion" + historique dans MessagerieClient.js).

ALTER TABLE public.assistant_messages
  ADD COLUMN IF NOT EXISTS conversation_id UUID;

-- Backfill : les lignes existantes appartenaient toutes à un fil implicite
-- unique par utilisateur (avant l'introduction de plusieurs conversations).
-- On leur assigne un même UUID de conversation par utilisateur pour ne rien
-- perdre — ce backfill est un no-op sur une base sans données historiques.
DO $$
DECLARE
  target_user UUID;
  new_conv_id UUID;
BEGIN
  FOR target_user IN
    SELECT DISTINCT user_id FROM public.assistant_messages WHERE conversation_id IS NULL
  LOOP
    new_conv_id := gen_random_uuid();
    UPDATE public.assistant_messages
      SET conversation_id = new_conv_id
      WHERE user_id = target_user AND conversation_id IS NULL;
  END LOOP;
END $$;

ALTER TABLE public.assistant_messages
  ALTER COLUMN conversation_id SET DEFAULT gen_random_uuid();

ALTER TABLE public.assistant_messages
  ALTER COLUMN conversation_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assistant_messages_conversation
  ON public.assistant_messages (user_id, conversation_id, created_at);
