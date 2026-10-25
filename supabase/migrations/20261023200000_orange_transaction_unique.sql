-- Un même transactionId Orange Money ne peut créditer QU'UNE seule fois (d'après la documentation officielle : les notifications sont
-- livrées « au moins une fois », éventuellement en double ou dans le désordre). La garde principale reste la transition atomique
-- pending → success par commande ; cette contrainte d'unicité est la garde de dernier recours en base.

-- Achats de jetons : provider_reference contient le qrId tant que la commande est « pending », puis le transactionId Orange au passage
-- à « success ». L'unicité ne vise donc que les commandes réussies.
CREATE UNIQUE INDEX IF NOT EXISTS jetons_transactions_orange_tx_unique
  ON public.jetons_transactions (provider_reference)
  WHERE type = 'achat' AND status = 'success' AND provider_reference IS NOT NULL;

-- Formation CV : nouvelle colonne dédiée au transactionId du paiement validé.
ALTER TABLE public.formation_redaction_cv_inscriptions
  ADD COLUMN IF NOT EXISTS orange_transaction_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS formation_redaction_cv_orange_tx_unique
  ON public.formation_redaction_cv_inscriptions (orange_transaction_id)
  WHERE orange_transaction_id IS NOT NULL;
