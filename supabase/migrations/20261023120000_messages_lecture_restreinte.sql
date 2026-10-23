-- Messages : plus d'accès général pour les rôles 'admin' et 'publisher' (décision du 23/10/2026).
--
-- Constat : les règles de lecture de `messages` (20260805000000_security_diagnostic_fixes.sql) autorisaient tout administrateur
-- ET tout publieur (recruteur) à lire TOUS les messages de TOUS les comptes. L'écran de la messagerie filtre côté application,
-- mais un appel direct à la base les exposait, et la page /admin/messages (conversations en lecture libre pour ces rôles)
-- affichait les messages de candidature des autres.
--
-- Nouvelle règle :
--   - chacun lit les messages qu'il envoie ou reçoit, et ceux des conversations dont il est participant (un recruteur reçoit
--     ainsi les candidatures des offres qu'il a publiées : il en est le destinataire) ;
--   - l'administrateur lit en plus les discussions de SUPPORT / RH (type_discussion = 'SUPPORT') — et seulement celles-là ;
--   - le publieur n'a plus aucun accès particulier ;
--   - les conversations suivent la même règle (participants uniquement).
-- Les écritures (INSERT) ne changent pas : le message part toujours au nom de son expéditeur.

-- 1. Lecture des messages : participants uniquement
DROP POLICY IF EXISTS "Lecture messages admin et participants" ON public.messages;
CREATE POLICY "Lecture messages admin et participants" ON public.messages
  FOR SELECT USING (
    sender_id = (select auth.uid())
    OR receiver_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id AND (c.user_1_id = (select auth.uid()) OR c.user_2_id = (select auth.uid()))
    )
  );

-- 2. Discussions de support / RH : administrateur uniquement (le publieur n'y a plus accès)
DROP POLICY IF EXISTS "Un admin lit les discussions de support" ON public.messages;
CREATE POLICY "Un admin lit les discussions de support" ON public.messages
  FOR SELECT USING (
    type_discussion = 'SUPPORT' AND public.current_user_role() = 'admin'
  );

-- 3. Mise à jour (marquer lu) : destinataire, ou administrateur sur le support uniquement
DROP POLICY IF EXISTS "Mise a jour messages admin et destinataires" ON public.messages;
CREATE POLICY "Mise a jour messages admin et destinataires" ON public.messages
  FOR UPDATE USING (
    receiver_id = (select auth.uid())
    OR (type_discussion = 'SUPPORT' AND public.current_user_role() = 'admin')
  );

-- 4. Conversations : participants uniquement (plus de lecture ni d'écriture générale pour admin / publisher)
DROP POLICY IF EXISTS "Lecture conversations admin et participants" ON public.conversations;
CREATE POLICY "Lecture conversations admin et participants" ON public.conversations
  FOR SELECT USING (
    user_1_id = (select auth.uid()) OR user_2_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "Ecriture conversations admin et participants" ON public.conversations;
CREATE POLICY "Ecriture conversations admin et participants" ON public.conversations
  FOR ALL USING (
    user_1_id = (select auth.uid()) OR user_2_id = (select auth.uid())
  );
