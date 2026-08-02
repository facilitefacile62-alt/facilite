-- Section 5 du chantier RBAC : "publisher" (employé/modérateur) doit
-- pouvoir répondre au support, mais reste strictement exclu des données
-- financières (KPay), de la gestion globale des utilisateurs et des
-- configurations système — ces policies-ci sont donc étendues à publisher,
-- et CELLES-LÀ SEULES. orders/transactions/subscriptions gardent
-- current_user_role() = 'admin' sans modification (vérifié dans
-- admin/dashboard/page.js, section RBAC : accès page bloqué à publisher).

DROP POLICY IF EXISTS "Un admin lit les discussions de support" ON public.messages;
CREATE POLICY "Un admin lit les discussions de support" ON public.messages
  FOR SELECT USING (type_discussion = 'SUPPORT' AND public.current_user_role() IN ('admin', 'publisher'));

DROP POLICY IF EXISTS "Un admin gere tous les fils de support" ON public.support_threads;
CREATE POLICY "Un admin gere tous les fils de support" ON public.support_threads
  FOR ALL USING (public.current_user_role() IN ('admin', 'publisher'));

DROP POLICY IF EXISTS "Lecture conversations admin et participants" ON public.conversations;
CREATE POLICY "Lecture conversations admin et participants" ON public.conversations
  FOR SELECT USING (
    user_1_id = auth.uid() OR user_2_id = auth.uid() OR public.current_user_role() IN ('admin', 'publisher')
  );

DROP POLICY IF EXISTS "Ecriture conversations admin et participants" ON public.conversations;
CREATE POLICY "Ecriture conversations admin et participants" ON public.conversations
  FOR ALL USING (
    user_1_id = auth.uid() OR user_2_id = auth.uid() OR public.current_user_role() IN ('admin', 'publisher')
  );

DROP POLICY IF EXISTS "Lecture messages admin et participants" ON public.messages;
CREATE POLICY "Lecture messages admin et participants" ON public.messages
  FOR SELECT USING (
    sender_id = auth.uid()
    OR receiver_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id AND (c.user_1_id = auth.uid() OR c.user_2_id = auth.uid())
    )
    OR public.current_user_role() IN ('admin', 'publisher')
  );

DROP POLICY IF EXISTS "Mise a jour messages admin et destinataires" ON public.messages;
CREATE POLICY "Mise a jour messages admin et destinataires" ON public.messages
  FOR UPDATE USING (receiver_id = auth.uid() OR public.current_user_role() IN ('admin', 'publisher'));

-- job_offers : publisher doit pouvoir approuver/modérer des offres
-- ("modération, approbation d'annonces", section 5) — lecture de toutes
-- les offres (déjà publiques de toute façon via "Lecture publique des
-- offres"), mais UPDATE (ex: dépublier une offre frauduleuse) nécessite
-- une policy dédiée, distincte de "Un recruteur modifie ses propres offres".
DROP POLICY IF EXISTS "Un moderateur gere toutes les offres" ON public.job_offers;
CREATE POLICY "Un moderateur gere toutes les offres" ON public.job_offers
  FOR UPDATE USING (public.current_user_role() IN ('admin', 'publisher'));
