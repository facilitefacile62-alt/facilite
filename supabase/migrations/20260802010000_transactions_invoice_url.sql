-- Découvert en vérifiant l'accès aux reçus d'achat : les recharges de
-- crédits (table transactions) n'ont jamais eu de facture générée — ni
-- stockée, ni envoyée par email — contrairement aux commandes de CV
-- (orders.invoice_url). Aucune colonne pour l'enregistrer.
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS invoice_url TEXT;
