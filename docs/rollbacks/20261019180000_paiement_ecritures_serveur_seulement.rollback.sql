-- ANNULATION de supabase/migrations/20261019180000_paiement_ecritures_serveur_seulement.sql.
-- Pas une migration (volontairement hors de supabase/migrations/). Application : npx supabase db query --linked --yes -f <ce fichier>
-- Effet : redonne aux utilisateurs connectés le droit d'INSÉRER leur commande de paiement et de modifier provider_reference (jetons et
-- formation CV), avec EXACTEMENT les politiques qui existaient avant la migration (relevées en production le 24/10/2026).
-- À n'utiliser que si les routes de paiement ne fonctionnent plus avec le rôle serveur.
GRANT INSERT ON public.jetons_transactions TO authenticated;
GRANT UPDATE (provider_reference) ON public.jetons_transactions TO authenticated;
DROP POLICY IF EXISTS "Un vendeur initie un achat de jetons pour sa boutique" ON public.jetons_transactions;
CREATE POLICY "Un vendeur initie un achat de jetons pour sa boutique" ON public.jetons_transactions
  FOR INSERT
  WITH CHECK (
    type = 'achat' AND status = 'pending'
    AND EXISTS (SELECT 1 FROM public.marketplace_stores s WHERE s.id = jetons_transactions.store_id AND s.owner_id = auth.uid())
  );
DROP POLICY IF EXISTS "Un vendeur met a jour la reference de paiement de sa transaction" ON public.jetons_transactions;
CREATE POLICY "Un vendeur met a jour la reference de paiement de sa transaction" ON public.jetons_transactions
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.marketplace_stores s WHERE s.id = jetons_transactions.store_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.marketplace_stores s WHERE s.id = jetons_transactions.store_id AND s.owner_id = auth.uid()));

GRANT INSERT ON public.formation_redaction_cv_inscriptions TO authenticated;
GRANT UPDATE (provider_reference) ON public.formation_redaction_cv_inscriptions TO authenticated;
DROP POLICY IF EXISTS "Un utilisateur initie son inscription formation CV" ON public.formation_redaction_cv_inscriptions;
CREATE POLICY "Un utilisateur initie son inscription formation CV" ON public.formation_redaction_cv_inscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND paye = false AND certifie = false);
DROP POLICY IF EXISTS "Un utilisateur pose la reference de paiement de sa formation CV" ON public.formation_redaction_cv_inscriptions;
CREATE POLICY "Un utilisateur pose la reference de paiement de sa formation CV" ON public.formation_redaction_cv_inscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
