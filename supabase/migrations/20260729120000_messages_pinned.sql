-- Fonctionnalité "message épinglé" : un message important (note du recruteur,
-- instructions, rappel) reste affiché en haut du fil de discussion.
--
-- Choix d'implémentation :
--   1. Colonne booléenne `is_pinned` sur public.messages (pas de table dédiée) :
--      un fil = un utilisateur ici, le volume est faible et l'index partiel rend
--      la lecture du message épinglé immédiate.
--   2. L'épinglage passe par une fonction RPC SECURITY DEFINER et NON par un
--      élargissement de la policy UPDATE. Raison : la policy actuelle limite
--      l'UPDATE à `auth.uid() = sender_id`. L'élargir au destinataire lui
--      donnerait aussi le droit de réécrire `content` / `is_read` du message
--      d'autrui. La fonction ci-dessous ne touche que la colonne `is_pinned`,
--      après vérification explicite d'appartenance au fil.

-- 1. COLONNE ------------------------------------------------------------------
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;

-- Index partiel : ne référence que les (rares) lignes épinglées.
CREATE INDEX IF NOT EXISTS idx_messages_is_pinned
  ON public.messages (sender_id, receiver_id)
  WHERE is_pinned;

-- 2. RPC D'ÉPINGLAGE ----------------------------------------------------------
-- Garantit l'invariant "au plus un message épinglé par fil" dans la même
-- transaction que l'épinglage : impossible de se retrouver avec deux bannières.
CREATE OR REPLACE FUNCTION public.toggle_message_pin(
  p_message_id UUID,
  p_pinned BOOLEAN
)
RETURNS public.messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_msg  public.messages;
  v_peer UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_msg FROM public.messages WHERE id = p_message_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message introuvable' USING ERRCODE = 'P0002';
  END IF;

  -- Contrôle d'accès explicite : SECURITY DEFINER contourne la RLS, on
  -- reproduit donc ici la règle de lecture (expéditeur OU destinataire).
  IF v_uid <> v_msg.sender_id
     AND (v_msg.receiver_id IS NULL OR v_uid <> v_msg.receiver_id) THEN
    RAISE EXCEPTION 'Accès refusé à ce message' USING ERRCODE = '42501';
  END IF;

  IF p_pinned THEN
    -- Interlocuteur du fil courant. NULL quand le message s'adresse au support
    -- (receiver_id non renseigné) : `IS NOT DISTINCT FROM` gère ce cas, là où
    -- un `=` classique renverrait NULL et ne filtrerait rien.
    v_peer := CASE WHEN v_msg.sender_id = v_uid
                   THEN v_msg.receiver_id
                   ELSE v_msg.sender_id
              END;

    UPDATE public.messages
       SET is_pinned = false
     WHERE is_pinned
       AND id <> p_message_id
       AND (
             (sender_id = v_uid AND receiver_id IS NOT DISTINCT FROM v_peer)
          OR (sender_id IS NOT DISTINCT FROM v_peer AND receiver_id = v_uid)
           );
  END IF;

  UPDATE public.messages
     SET is_pinned = p_pinned
   WHERE id = p_message_id
  RETURNING * INTO v_msg;

  RETURN v_msg;
END;
$$;

-- Exposée aux seuls utilisateurs authentifiés (jamais au rôle anon).
REVOKE ALL ON FUNCTION public.toggle_message_pin(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_message_pin(UUID, BOOLEAN) TO authenticated;
