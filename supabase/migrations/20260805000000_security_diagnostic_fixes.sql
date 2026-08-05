-- =====================================================================
-- FIX SECURITE : Optimisation RLS et Index (Audit Point 112)
-- =====================================================================

-- 1. Ajout de l'index manquant sur candidatures.user_id
-- (Les tables conversations et applications sont déjà gérées)
CREATE INDEX IF NOT EXISTS idx_candidatures_user_id ON public.candidatures(user_id);

-- 2. Optimisation RLS avec (select auth.uid()) pour forcer le cache de PostgreSQL

-- TABLE : candidatures
DROP POLICY IF EXISTS "Lecture de ses propres candidatures" ON public.candidatures;
CREATE POLICY "Lecture de ses propres candidatures" ON public.candidatures
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Creation de ses propres candidatures" ON public.candidatures;
CREATE POLICY "Creation de ses propres candidatures" ON public.candidatures
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);


-- TABLE : conversations
DROP POLICY IF EXISTS "Lecture conversations admin et participants" ON public.conversations;
CREATE POLICY "Lecture conversations admin et participants" ON public.conversations
  FOR SELECT USING (
    user_1_id = (select auth.uid()) OR user_2_id = (select auth.uid()) OR public.current_user_role() IN ('admin', 'publisher')
  );

DROP POLICY IF EXISTS "Ecriture conversations admin et participants" ON public.conversations;
CREATE POLICY "Ecriture conversations admin et participants" ON public.conversations
  FOR ALL USING (
    user_1_id = (select auth.uid()) OR user_2_id = (select auth.uid()) OR public.current_user_role() IN ('admin', 'publisher')
  );


-- TABLE : messages
DROP POLICY IF EXISTS "Lecture messages admin et participants" ON public.messages;
CREATE POLICY "Lecture messages admin et participants" ON public.messages
  FOR SELECT USING (
    sender_id = (select auth.uid())
    OR receiver_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id AND (c.user_1_id = (select auth.uid()) OR c.user_2_id = (select auth.uid()))
    )
    OR public.current_user_role() IN ('admin', 'publisher')
  );

DROP POLICY IF EXISTS "Mise a jour messages admin et destinataires" ON public.messages;
CREATE POLICY "Mise a jour messages admin et destinataires" ON public.messages
  FOR UPDATE USING (receiver_id = (select auth.uid()) OR public.current_user_role() IN ('admin', 'publisher'));
