-- Communication globale multi-rôles : ajoute un 3ème type de discussion
-- 'SUPPORT' (en plus de 'OFFRE' et 'ECHANGE'), lisible par tout admin quel
-- que soit l'expéditeur/destinataire, avec suivi de statut par demandeur.

-- 1. Élargit le CHECK type_discussion pour accepter 'SUPPORT'.
-- job_offer_id et receiver_id sont déjà nullable (migrations 20260727090000
-- et 20260730015400) : rien à changer pour permettre des discussions
-- ECHANGE/SUPPORT sans offre ni destinataire fixe.
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_type_discussion_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_type_discussion_check
  CHECK (type_discussion IN ('OFFRE', 'ECHANGE', 'SUPPORT'));

-- 2. Un admin peut lire toute discussion de type SUPPORT, même s'il n'en est
-- ni l'expéditeur ni le destinataire (policy additive, s'ajoute à "Lecture
-- des messages envoyes ou recus" définie dans 20260727090000 — les policies
-- RLS sont combinées en OR). L'écriture (réponse) n'a besoin d'aucune policy
-- supplémentaire : "Envoi de messages en son propre nom uniquement"
-- (WITH CHECK auth.uid() = sender_id) couvre déjà un admin qui répond en son
-- propre nom, quel que soit type_discussion.
DROP POLICY IF EXISTS "Un admin lit les discussions de support" ON public.messages;
CREATE POLICY "Un admin lit les discussions de support" ON public.messages
  FOR SELECT USING (
    type_discussion = 'SUPPORT' AND public.current_user_role() = 'admin'
  );

-- 3. Suivi du statut d'une demande de support (Non lu / En cours / Résolu).
-- Le statut n'a de sens qu'au niveau du FIL entier, pas d'un message
-- individuel : une table séparée, une ligne par demandeur, plutôt qu'une
-- colonne sur messages.
CREATE TABLE IF NOT EXISTS public.support_threads (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'in_progress', 'resolved')),
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Un utilisateur lit son propre fil de support" ON public.support_threads;
CREATE POLICY "Un utilisateur lit son propre fil de support" ON public.support_threads
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Un admin gere tous les fils de support" ON public.support_threads;
CREATE POLICY "Un admin gere tous les fils de support" ON public.support_threads
  FOR ALL USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- 4. Synchronisation automatique du statut à chaque nouveau message SUPPORT :
--   - le demandeur écrit  → statut 'unread' (nouvelle demande à traiter)
--   - un admin répond     → statut 'in_progress'
-- Le "demandeur" (user_id de support_threads) est déterminé par
-- COALESCE(receiver_id, sender_id) : le premier message d'une demande a
-- receiver_id NULL (pas d'admin ciblé en particulier — "Contacter le
-- Support" n'a pas à choisir UN admin précis), donc sender_id EST le
-- demandeur ; une réponse admin renseigne receiver_id = demandeur, donc le
-- même COALESCE le retrouve dans les deux cas sans avoir à connaître le rôle
-- de l'expéditeur.
CREATE OR REPLACE FUNCTION public.sync_support_thread()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester UUID;
BEGIN
  IF NEW.type_discussion IS DISTINCT FROM 'SUPPORT' THEN
    RETURN NEW;
  END IF;

  v_requester := COALESCE(NEW.receiver_id, NEW.sender_id);

  IF v_requester IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.support_threads (user_id, status, last_message_at, updated_at)
  VALUES (
    v_requester,
    CASE WHEN NEW.sender_id = v_requester THEN 'unread' ELSE 'in_progress' END,
    NEW.created_at,
    timezone('utc'::text, now())
  )
  ON CONFLICT (user_id) DO UPDATE SET
    status = CASE WHEN NEW.sender_id = v_requester THEN 'unread' ELSE 'in_progress' END,
    last_message_at = EXCLUDED.last_message_at,
    updated_at = timezone('utc'::text, now());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_support_thread ON public.messages;
CREATE TRIGGER trg_sync_support_thread
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.sync_support_thread();
