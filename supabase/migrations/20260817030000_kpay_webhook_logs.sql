-- Journal d'audit append-only des webhooks KPay reçus.
--
-- Jusqu'ici, tout webhook dont le statut n'était pas COMPLETED (FAILED,
-- CANCELLED...) était ignoré silencieusement par route.js — retour
-- {received:true} sans aucune écriture, pas même un console.error. Résultat
-- constaté en base le 2026-08-17 : des commandes restées 'pending'
-- indéfiniment alors que KPay avait bien notifié un échec (ex. solde
-- insuffisant). Impossible de distinguer a posteriori "KPay n'a jamais
-- notifié" de "KPay a notifié un échec qu'on a raté" — corrigé en même
-- temps que le traitement des statuts FAILED/CANCELLED
-- (src/app/api/pay/kpay-webhook/route.js).
--
-- Append-only comme security_logs (20260802070000) : ni UPDATE ni DELETE
-- accordés à quiconque, admin compris — un journal modifiable après coup ne
-- prouve rien.

CREATE TABLE IF NOT EXISTS public.kpay_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT,
  amount NUMERIC,
  currency TEXT,
  kpay_payment_id TEXT,
  external_id TEXT,
  matched_type TEXT CHECK (matched_type IN ('order', 'transaction')),
  matched_id UUID,
  raw_payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kpay_webhook_logs_received_at ON public.kpay_webhook_logs(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_kpay_webhook_logs_matched_id ON public.kpay_webhook_logs(matched_id);

ALTER TABLE public.kpay_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Lecture admin uniquement : le payload brut contient potentiellement le
-- numéro de téléphone Mobile Money du client (event.phoneNumber) — jamais
-- exposé au propriétaire de la commande ni à qui que ce soit d'autre.
DROP POLICY IF EXISTS "Seuls les admins lisent les logs webhook KPay" ON public.kpay_webhook_logs;
CREATE POLICY "Seuls les admins lisent les logs webhook KPay" ON public.kpay_webhook_logs
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Écriture réservée à service_role (webhook via getSupabaseAdmin(), voir
-- src/lib/supabaseAdmin.js) — aucun GRANT INSERT à anon/authenticated,
-- cohérent avec security_logs. Depuis la migration
-- 20260807130000_fix_default_privileges_public_schema, une table neuve
-- n'hérite plus rien pour anon/authenticated (service_role garde tout par
-- défaut) : GRANT SELECT explicite nécessaire pour que la policy RLS
-- ci-dessus ait quelque chose à filtrer.
GRANT SELECT ON public.kpay_webhook_logs TO authenticated;
