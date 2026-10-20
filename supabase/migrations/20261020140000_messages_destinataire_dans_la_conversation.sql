-- Messages : le destinataire doit faire partie de LA conversation du message (garde-fou côté base).
--
-- Constat (test « avant publicité », 19/10/2026) : la messagerie du site envoyait la réponse d'un vendeur au compte
-- support au lieu de l'acheteur. Rien en base ne vérifiait la cohérence entre conversation_id et receiver_id : la
-- politique d'insertion ne contrôle que « sender_id = auth.uid() ». Un message pouvait donc être rattaché à n'importe quel
-- destinataire. Le client est corrigé ; ce déclencheur empêche la même erreur — ou un appel direct à l'API — de
-- recommencer.
--
-- Règle : quand un message porte à la fois conversation_id et receiver_id, ses deux participants (expéditeur et
-- destinataire) doivent être exactement les deux personnes de la conversation. Messages sans conversation ou sans
-- destinataire (historique, certains envois au support) : inchangés. Vérifié avant création sur toute la base de
-- production : aucun message existant ne viole cette règle (0 sur 570).

CREATE OR REPLACE FUNCTION public.verifier_destinataire_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.conversation_id IS NULL OR NEW.receiver_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = NEW.conversation_id
      AND (
        (c.user_1_id = NEW.sender_id AND c.user_2_id = NEW.receiver_id)
        OR (c.user_2_id = NEW.sender_id AND c.user_1_id = NEW.receiver_id)
      )
  ) THEN
    RAISE EXCEPTION 'Destinataire invalide : il ne fait pas partie de cette conversation.' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

-- Fonction de déclencheur : jamais appelée directement par un client.
REVOKE ALL ON FUNCTION public.verifier_destinataire_message() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_verifier_destinataire_message ON public.messages;
CREATE TRIGGER trg_verifier_destinataire_message
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.verifier_destinataire_message();
