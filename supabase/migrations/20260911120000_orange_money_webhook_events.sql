-- Idempotence des webhooks Orange Money "Paiement Marchand" (QR code).
--
-- Contrairement à KPay (aucune notion d'idempotence documentée, dédupliqué
-- uniquement via la transition atomique status pending->success sur
-- "transactions"), Orange documente explicitement un header
-- X-Sonatel-Idempotency-Key : le même événement peut être renvoyé plusieurs
-- fois (retries réseau), et doit être traité une seule fois. La contrainte
-- UNIQUE ci-dessous est le mécanisme réel de déduplication — la route
-- (src/app/api/pay/orange-money-webhook/route.js) tente un INSERT avant
-- tout traitement métier ; un conflit signifie "déjà traité", pas une
-- erreur.
--
-- Sert aussi de journal d'audit append-only (payload brut), même
-- raisonnement que kpay_webhook_logs (20260817030000) : distinguer a
-- posteriori "jamais reçu" de "reçu mais raté".
--
-- Aucune nouvelle table n'est créée pour les transactions elles-mêmes : la
-- table générique "transactions" (20260801200000_transactions_subscriptions_credits)
-- déjà utilisée par le flux de recharge de crédits KPay est réutilisée telle
-- quelle (provider='orange_money', metadata JSONB pour qrId/deepLinks/
-- reference/transactionId Orange) — cohérent avec son propre commentaire de
-- tête ("sert aux recharges de crédits génériques... futurs plans").
-- "subscriptions" (même migration) sert de même à représenter le statut
-- Premium actif, sans colonne profiles.is_premium supplémentaire.

CREATE TABLE IF NOT EXISTS public.orange_money_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT,
  orange_transaction_id TEXT,
  reference TEXT,
  transaction_id UUID REFERENCES public.transactions(id),
  raw_payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orange_money_webhook_events_transaction_id ON public.orange_money_webhook_events(transaction_id);
CREATE INDEX IF NOT EXISTS idx_orange_money_webhook_events_received_at ON public.orange_money_webhook_events(received_at DESC);

ALTER TABLE public.orange_money_webhook_events ENABLE ROW LEVEL SECURITY;

-- Lecture admin uniquement : le payload brut contient potentiellement des
-- identifiants client Orange Money — même politique que kpay_webhook_logs
-- et processed_webhooks.
DROP POLICY IF EXISTS "Seuls les admins lisent les evenements webhook Orange Money" ON public.orange_money_webhook_events;
CREATE POLICY "Seuls les admins lisent les evenements webhook Orange Money" ON public.orange_money_webhook_events
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Écriture réservée à service_role (webhook via getSupabaseAdmin()) — aucun
-- GRANT INSERT à anon/authenticated. GRANT SELECT explicite requis depuis la
-- correction DEFAULT PRIVILEGES (20260807130000) pour que la policy
-- ci-dessus ait quelque chose à filtrer.
GRANT SELECT ON public.orange_money_webhook_events TO authenticated;

-- =====================================================================
-- Policy RLS manquante sur "transactions" pour provider_reference — même
-- anomalie que celle corrigée pour "orders" par
-- 20260807150000_orders_owner_update_payment_reference_policy.sql : le GRANT
-- colonne (GRANT UPDATE (provider_reference) ON public.transactions TO
-- authenticated, déjà posé par 20260802250000_wave3_update_columns.sql)
-- ne suffit pas seul — sans policy RLS UPDATE, PostgREST rejette
-- silencieusement (0 ligne affectée) toute tentative d'écriture, même sur
-- une colonne autorisée par le GRANT. Resté invisible jusqu'ici car le
-- flux "transactions" (recharge de crédits KPay) n'a jamais eu de
-- provider_reference posé après coup par le client — KPay pose la
-- référence de paiement à l'initiation même (voir checkout/route.js). Le
-- flux Orange Money (src/app/api/pay/orange-money-checkout/route.js) pose
-- provider_reference (qrId) APRÈS l'insertion initiale, ce qui exerce ce
-- chemin pour la première fois.
-- =====================================================================

DROP POLICY IF EXISTS "Un candidat met a jour la reference de paiement de sa propre transaction" ON public.transactions;
CREATE POLICY "Un candidat met a jour la reference de paiement de sa propre transaction"
  ON public.transactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
