-- Migration d'ajout du champ conversation_id à la table assistant_messages.
-- Si la colonne n'existe pas, on l'ajoute et on crée un index pour des performances optimales lors du filtrage par session/discussion.

ALTER TABLE public.assistant_messages 
ADD COLUMN IF NOT EXISTS conversation_id UUID DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS idx_assistant_messages_conv_created
  ON public.assistant_messages (user_id, conversation_id, created_at);
