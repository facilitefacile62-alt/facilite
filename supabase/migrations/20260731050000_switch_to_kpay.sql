-- Bascule de la passerelle de paiement Paystack -> KPay pour l'achat de CV.
-- Renomme la colonne pour rester agnostique du fournisseur (déjà utilisée
-- pour stocker la référence de transaction Paystack ; contiendra désormais
-- la référence KPay — même rôle, autre fournisseur).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'paystack_reference'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'payment_reference'
  ) THEN
    ALTER TABLE public.orders RENAME COLUMN paystack_reference TO payment_reference;
  END IF;
END $$;
