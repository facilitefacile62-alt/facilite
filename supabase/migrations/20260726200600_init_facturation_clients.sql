-- Migration d'initialisation : Entreprise, Clients, Factures
-- Date: 2026-07-26
-- Description: Schéma métier complet avec clés primaires UUID, clés étrangères, timestamps et RLS

-- 1. TABLE ENTREPRISE (company_settings)
CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Facilité Corporation',
  email TEXT,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  tax_rate NUMERIC(5,2) DEFAULT 18.00, -- TVA 18% par défaut
  currency TEXT DEFAULT 'FCFA',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABLE CLIENTS (clients)
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  company TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABLE FACTURES (invoices)
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.company_settings(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  status TEXT DEFAULT 'brouillon' CHECK (status IN ('brouillon', 'envoyee', 'payee', 'en_retard')),
  issue_date DATE DEFAULT CURRENT_DATE NOT NULL,
  due_date DATE,
  items JSONB DEFAULT '[]'::jsonb NOT NULL,
  subtotal NUMERIC(15,2) DEFAULT 0.00 NOT NULL,
  tax_amount NUMERIC(15,2) DEFAULT 0.00 NOT NULL,
  total_amount NUMERIC(15,2) DEFAULT 0.00 NOT NULL,
  currency TEXT DEFAULT 'FCFA' NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index pour optimiser les performances de requêtes
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_company_settings_user_id ON public.company_settings(user_id);

-- 4. POLITIQUES DE SÉCURITÉ PAR RLS (Row Level Security)
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Politiques pour company_settings
DROP POLICY IF EXISTS "Les utilisateurs gèrent leur propre entreprise" ON public.company_settings;
CREATE POLICY "Les utilisateurs gèrent leur propre entreprise" ON public.company_settings
  FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

-- Politiques pour clients
DROP POLICY IF EXISTS "Les utilisateurs gèrent leurs propres clients" ON public.clients;
CREATE POLICY "Les utilisateurs gèrent leurs propres clients" ON public.clients
  FOR ALL USING (auth.uid() = user_id);

-- Politiques pour invoices
DROP POLICY IF EXISTS "Les utilisateurs gèrent leurs propres factures" ON public.invoices;
CREATE POLICY "Les utilisateurs gèrent leurs propres factures" ON public.invoices
  FOR ALL USING (auth.uid() = user_id);

-- Trigger pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = timezone('utc'::text, now());
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_company_settings_modtime BEFORE UPDATE ON public.company_settings FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER update_clients_modtime BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER update_invoices_modtime BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
