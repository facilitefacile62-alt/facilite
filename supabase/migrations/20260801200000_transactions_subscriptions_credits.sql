-- Complète l'infrastructure crédits amorcée par le webhook KPay
-- (kpay-webhook/route.js écrit déjà dans "transactions" et "subscriptions",
-- et candidat/facturation/page.js les lit déjà en parallèle de "orders") —
-- mais aucune des deux tables n'avait jamais été créée : tout paiement,
-- CV comme recharge de crédits, échouait (404 "relation does not exist").
--
-- Coexiste avec "orders" (paiement unique par CV, table déjà existante,
-- inchangée) plutôt que de la remplacer : "transactions" sert uniquement
-- aux recharges de crédits génériques (achats IA, futurs plans).

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XOF',
  provider TEXT NOT NULL DEFAULT 'kpay',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  provider_reference TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_provider_reference ON public.transactions(provider_reference);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Un candidat lit ses propres transactions" ON public.transactions;
CREATE POLICY "Un candidat lit ses propres transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Insertion faite par le client au nom de l'utilisateur connecté (checkout),
-- jamais par un tiers pour un autre user_id.
DROP POLICY IF EXISTS "Un candidat cree ses propres transactions" ON public.transactions;
CREATE POLICY "Un candidat cree ses propres transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Aucune policy UPDATE pour les utilisateurs authentifiés : seul le webhook
-- (service_role, contourne RLS) fait passer une transaction en "success".

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_name TEXT,
  credits INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Un candidat lit son propre solde de credits" ON public.subscriptions;
CREATE POLICY "Un candidat lit son propre solde de credits" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Pas de policy INSERT/UPDATE utilisateur : le solde ne doit être modifié
-- que par le webhook (crédit après paiement) ou par les routes serveur qui
-- déduisent un coût (service_role également) — jamais directement par le
-- client, qui pourrait sinon s'auto-créditer.
