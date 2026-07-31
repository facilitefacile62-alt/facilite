-- Défense en profondeur pour l'idempotence du webhook Paystack (audit du
-- commit 8e324a3) : une commande n'a jamais plus d'une affectation agent.
-- L'update atomique payment_status pending->paid dans le webhook empêche déjà
-- le double traitement sous concurrence, mais une contrainte au niveau base
-- garantit l'invariant même en cas de futur appel manuel/hors-webhook.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agent_assignments_order_id_key'
  ) THEN
    ALTER TABLE public.agent_assignments
      ADD CONSTRAINT agent_assignments_order_id_key UNIQUE (order_id);
  END IF;
END $$;
