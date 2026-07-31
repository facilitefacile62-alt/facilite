-- Module de tarification, paiement multi-canal (Paystack) et facturation PDF
-- pour la confection de CV.
-- Date: 2026-07-31

-- 1. TABLE ORDERS (commandes de confection de CV)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cv_model_id TEXT NOT NULL,
  has_agent_option BOOLEAN NOT NULL DEFAULT false,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XOF',
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  payment_method TEXT,
  paystack_reference TEXT UNIQUE,
  invoice_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_paystack_reference ON public.orders(paystack_reference);

-- 2. TABLE AGENT_ASSIGNMENTS (affectation d'un agent pour l'option accompagnée)
CREATE TABLE IF NOT EXISTS public.agent_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'unassigned' CHECK (status IN ('unassigned', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_assignments_order_id ON public.agent_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_agent_assignments_candidate_id ON public.agent_assignments(candidate_id);
CREATE INDEX IF NOT EXISTS idx_agent_assignments_agent_id ON public.agent_assignments(agent_id);

-- Trigger updated_at (réutilise la fonction existante si déjà créée par une
-- migration précédente, sinon la (re)crée de façon idempotente).
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = timezone('utc'::text, now());
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_orders_modtime ON public.orders;
CREATE TRIGGER update_orders_modtime BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- 3. RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_assignments ENABLE ROW LEVEL SECURITY;

-- orders : le candidat lit et crée ses propres commandes. Les mises à jour de
-- statut de paiement passent exclusivement par le webhook Paystack, qui utilise
-- la clé service_role (contourne RLS) — aucune politique UPDATE candidat n'est
-- donc nécessaire ni souhaitable ici.
DROP POLICY IF EXISTS "Un candidat lit ses propres commandes" ON public.orders;
CREATE POLICY "Un candidat lit ses propres commandes" ON public.orders
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Un candidat crée ses propres commandes" ON public.orders;
CREATE POLICY "Un candidat crée ses propres commandes" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- current_user_role() : fonction SECURITY DEFINER déjà introduite dans
-- 20260730000200_fix_profiles_rls_recursion.sql, réutilisée ici pour éviter
-- toute récursion RLS sur profiles.
DROP POLICY IF EXISTS "Un admin lit toutes les commandes" ON public.orders;
CREATE POLICY "Un admin lit toutes les commandes" ON public.orders
  FOR SELECT USING (public.current_user_role() = 'admin');

-- agent_assignments : le candidat concerné et l'agent affecté lisent la ligne ;
-- l'admin lit tout (dashboard d'attribution).
DROP POLICY IF EXISTS "Le candidat lit son affectation" ON public.agent_assignments;
CREATE POLICY "Le candidat lit son affectation" ON public.agent_assignments
  FOR SELECT USING (auth.uid() = candidate_id);

DROP POLICY IF EXISTS "L'agent lit ses affectations" ON public.agent_assignments;
CREATE POLICY "L'agent lit ses affectations" ON public.agent_assignments
  FOR SELECT USING (auth.uid() = agent_id);

DROP POLICY IF EXISTS "Un admin gère toutes les affectations" ON public.agent_assignments;
CREATE POLICY "Un admin gère toutes les affectations" ON public.agent_assignments
  FOR ALL USING (public.current_user_role() = 'admin');

-- 4. STORAGE : bucket privé pour les factures PDF
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Chemin de stockage attendu : {user_id}/{order_id}.pdf — les policies
-- s'appuient donc sur le premier segment de dossier, pas sur le nom de fichier.
DROP POLICY IF EXISTS "Un candidat lit sa propre facture" ON storage.objects;
CREATE POLICY "Un candidat lit sa propre facture" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'invoices' AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- L'écriture des factures se fait uniquement côté serveur via supabaseAdmin
-- (clé service_role, qui contourne RLS) lors de la génération automatique
-- après paiement confirmé — aucune policy INSERT/UPDATE candidat n'est ouverte
-- ici, volontairement.
