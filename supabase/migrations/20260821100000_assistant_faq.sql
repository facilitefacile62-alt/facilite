-- Base de connaissances FAQ de l'assistant vocal, gérée depuis l'admin
-- plutôt que codée en dur dans le SYSTEM_PROMPT (même principe que la base
-- d'itinéraires déjà en place : hors base = réponse de repli, jamais
-- inventée).
--
-- Table verrouillée service_role UNIQUEMENT, lecture ET écriture — même
-- principe que ai_usage_daily/cv_consultations (0 policy RLS, aucun GRANT à
-- authenticated). Contrairement à l'idée initiale d'une écriture "admin via
-- sa propre session" (RLS + GRANT UPDATE direct), l'inspection de
-- l'invariant 1 confirme qu'AUCUNE table de ce dépôt n'accorde UPDATE/DELETE
-- direct à authenticated ailleurs — chaque écriture passe par une route API
-- service_role (vérification isCallerAdmin) ou une fonction SECURITY
-- DEFINER. Rester cohérent avec ce patron plutôt que d'être la première
-- exception : le panneau admin lit ET écrit via une route API dédiée
-- (service_role + isCallerAdmin), jamais directement depuis le client.
-- Pas de DELETE : "désactiver" passe par la colonne actif, jamais une
-- suppression réelle (un contenu retiré aujourd'hui peut redevenir
-- pertinent, et l'historique de ce qui a été affiché à l'assistant a sa
-- propre valeur).

CREATE TABLE public.assistant_faq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  reponse TEXT NOT NULL,
  categorie TEXT,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_assistant_faq_actif ON public.assistant_faq (actif) WHERE actif = true;

ALTER TABLE public.assistant_faq ENABLE ROW LEVEL SECURITY;

-- Aucune policy, aucun GRANT à authenticated/anon : la connexion
-- DEFAULT PRIVILEGES (fix_default_privileges_public_schema, 2026-08-07) ne
-- laisse déjà rien hériter par défaut, donc rien à révoquer explicitement —
-- seul service_role (grants Postgres natifs, jamais RLS) peut lire/écrire.

-- updated_at tenu à jour automatiquement, même patron que le reste du
-- dépôt pour les tables avec suivi de modification.
CREATE OR REPLACE FUNCTION public.set_assistant_faq_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assistant_faq_updated_at
  BEFORE UPDATE ON public.assistant_faq
  FOR EACH ROW EXECUTE FUNCTION public.set_assistant_faq_updated_at();
