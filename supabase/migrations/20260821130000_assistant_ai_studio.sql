-- Persistance serveur pour l'onglet admin "Entraînement IA"
-- (src/components/AdminAIStudio.jsx), jusqu'ici entièrement stockée dans
-- le localStorage du navigateur de chaque admin (clé FACILITE_AI_STUDIO_V2)
-- — invisible d'un poste à l'autre, jamais réellement partagée. Même
-- principe que assistant_faq (20260821100000_assistant_faq.sql) : verrouillé
-- service_role uniquement, lecture ET écriture via une route API admin
-- dédiée (isCallerAdmin), 0 policy RLS.
--
-- Deux tables plutôt qu'une : assistant_ai_products est une vraie liste
-- (aujourd'hui affichée en lecture seule dans l'UI, mais conçue pour
-- pouvoir devenir éditable ligne à ligne plus tard sans nouvelle
-- migration), assistant_ai_config est un réglage global unique (id figé
-- à 1 par CHECK, jamais plusieurs lignes).

CREATE TABLE public.assistant_ai_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  prompt_text TEXT NOT NULL DEFAULT '',
  knowledge_text TEXT NOT NULL DEFAULT '',
  diagnostic_rules_text TEXT NOT NULL DEFAULT '',
  comm_style TEXT NOT NULL DEFAULT 'normal',
  selected_model TEXT NOT NULL DEFAULT 'deepseek-chat',
  currency TEXT NOT NULL DEFAULT 'FCFA',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.assistant_ai_config ENABLE ROW LEVEL SECURITY;
-- Aucune policy, aucun GRANT à authenticated/anon — service_role uniquement,
-- comme assistant_faq.

CREATE TABLE public.assistant_ai_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price_fcfa NUMERIC NOT NULL DEFAULT 0,
  price_eur NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  actif BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assistant_ai_products_order ON public.assistant_ai_products (display_order);

ALTER TABLE public.assistant_ai_products ENABLE ROW LEVEL SECURITY;
-- Aucune policy, aucun GRANT à authenticated/anon — service_role uniquement.

CREATE OR REPLACE FUNCTION public.set_assistant_ai_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assistant_ai_config_updated_at
  BEFORE UPDATE ON public.assistant_ai_config
  FOR EACH ROW EXECUTE FUNCTION public.set_assistant_ai_updated_at();

CREATE TRIGGER trg_assistant_ai_products_updated_at
  BEFORE UPDATE ON public.assistant_ai_products
  FOR EACH ROW EXECUTE FUNCTION public.set_assistant_ai_updated_at();
