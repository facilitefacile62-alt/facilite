-- Correction : les messages envoyés par un candidat/recruteur depuis
-- /messagerie via la boîte de saisie normale (pas via "Contacter le
-- Support") sont insérés avec receiver_id = NULL et conversation_id = NULL
-- (voir src/lib/messages.js:sendMessage, appelé sans destinataire précis
-- pour le fil fusionné "Support RH Facilité"). Résultat : ces messages
-- n'apparaissent nulle part côté admin — /admin/messages est entièrement
-- construit autour de la table conversations, et un message sans
-- conversation_id ni receiver_id ne matche aucune de ses requêtes.
--
-- Ce fichier fait deux choses :
--   1. Rattache rétroactivement les messages déjà orphelins à une
--      conversation avec le premier compte admin disponible (les crée si
--      nécessaire), pour que l'historique déjà envoyé redevienne visible.
--   2. Le vrai correctif (empêcher que de nouveaux messages redeviennent
--      orphelins) est côté application : src/lib/messages.js résout
--      désormais toujours une conversation avec un admin avant d'envoyer.

DO $$
DECLARE
  v_admin_id UUID;
  v_sender RECORD;
  v_conv_id UUID;
  v_last RECORD;
BEGIN
  -- Premier admin disponible (le plus ancien), utilisé comme destinataire
  -- par défaut pour les messages orphelins.
  SELECT id INTO v_admin_id FROM public.profiles WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1;

  IF v_admin_id IS NULL THEN
    RETURN;
  END IF;

  FOR v_sender IN
    SELECT DISTINCT m.sender_id
    FROM public.messages m
    JOIN public.profiles p ON p.id = m.sender_id
    WHERE m.receiver_id IS NULL
      AND m.conversation_id IS NULL
      AND p.role <> 'admin'
  LOOP
    -- Conversation existante entre ce sender et l'admin (peu importe l'ordre
    -- user_1/user_2), sinon création.
    SELECT id INTO v_conv_id
    FROM public.conversations
    WHERE (user_1_id = v_sender.sender_id AND user_2_id = v_admin_id)
       OR (user_1_id = v_admin_id AND user_2_id = v_sender.sender_id)
    LIMIT 1;

    IF v_conv_id IS NULL THEN
      INSERT INTO public.conversations (user_1_id, user_2_id, last_message, updated_at)
      VALUES (v_sender.sender_id, v_admin_id, '', now())
      RETURNING id INTO v_conv_id;
    END IF;

    UPDATE public.messages
    SET conversation_id = v_conv_id,
        receiver_id = v_admin_id
    WHERE sender_id = v_sender.sender_id
      AND receiver_id IS NULL
      AND conversation_id IS NULL;

    SELECT content, created_at INTO v_last
    FROM public.messages
    WHERE conversation_id = v_conv_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_last.content IS NOT NULL THEN
      UPDATE public.conversations
      SET last_message = v_last.content,
          updated_at = v_last.created_at
      WHERE id = v_conv_id;
    END IF;
  END LOOP;
END $$;
