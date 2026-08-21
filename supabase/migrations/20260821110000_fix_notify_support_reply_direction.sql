-- Correctif de notify_support_reply() (20260814090000_notify_support_reply.sql).
--
-- Diagnostic (vérifié empiriquement, pas seulement lu dans le code) : la
-- fonction supposait que seul le CANDIDAT a receiver_id NULL sur son propre
-- message ("le premier message d'une demande a receiver_id NULL"). Ce n'est
-- plus vrai depuis resolveSupportConversation() (src/lib/messages.js) : un
-- message du candidat porte désormais TOUJOURS receiver_id = l'admin résolu
-- (confirmé sur un message réel envoyé via le chemin applicatif exact,
-- 2026-08-21). Résultat : v_requester = COALESCE(receiver_id, sender_id)
-- valait déjà l'ADMIN pour un message du candidat, donc le trigger notifiait
-- déjà l'admin sur CHAQUE message candidat — mais avec le texte et le lien
-- prévus pour l'autre sens ("Le support Facilite vous a répondu.",
-- /messagerie), non sensé pour un admin recevant un nouveau message.
--
-- Le vrai trou n'était donc pas "aucune notification admin" mais "texte et
-- lien faux pour la moitié des cas" — ce correctif distingue le sens réel du
-- message (sender admin ou non, via user_roles) plutôt que de déduire le
-- destinataire via un COALESCE qui ne portait plus l'information attendue.
-- Le destinataire (NEW.receiver_id) était déjà correct dans les deux sens ;
-- seuls le texte et le lien étaient à corriger.

CREATE OR REPLACE FUNCTION public.notify_support_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sender_is_admin BOOLEAN;
BEGIN
  -- Lignes historiques antérieures à resolveSupportConversation() : receiver_id
  -- peut être NULL (aucun destinataire connu) — rien à notifier, pas une erreur.
  IF NEW.receiver_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.sender_id AND role = 'admin' AND status = 'active'
  ) INTO v_sender_is_admin;

  IF v_sender_is_admin THEN
    INSERT INTO public.notifications (user_id, actor_id, type, content, link)
    VALUES (NEW.receiver_id, NEW.sender_id, 'message', 'Le support Facilite vous a répondu.', '/messagerie');
  ELSE
    INSERT INTO public.notifications (user_id, actor_id, type, content, link)
    VALUES (NEW.receiver_id, NEW.sender_id, 'message', 'Nouveau message support à traiter.', '/admin/messages');
  END IF;

  RETURN NEW;
END;
$$;
