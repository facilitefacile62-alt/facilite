-- Ajoute la colonne receiver_id manquante sur public.messages.
--
-- Contexte : la migration 20260727090000 crée une policy SELECT qui référence
-- messages.receiver_id, mais cette colonne n'a jamais été définie par aucune
-- migration — la table préexistait en production, créée hors historique Git.
-- Rejouer les migrations sur une base neuve échouait donc en erreur SQL.
--
-- Cette migration est idempotente : elle ne fait rien si la colonne existe déjà
-- (cas de la production). Le correctif de rejouabilité proprement dit a été
-- appliqué directement dans 20260727090000, qui doit pouvoir s'exécuter seule.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages(receiver_id);
