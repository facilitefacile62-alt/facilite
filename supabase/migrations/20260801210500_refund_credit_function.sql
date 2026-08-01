-- Symétrique de deduct_credit() : remboursement quand l'appel IA échoue
-- côté fournisseur après que le crédit a déjà été débité (débit avant
-- appel, volontairement, pour ne jamais lancer un appel IA sans garantie
-- de crédit disponible — voir /api/cv/improve-text).
CREATE OR REPLACE FUNCTION public.refund_credit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  rows_affected INT;
BEGIN
  UPDATE public.subscriptions
  SET credits = credits + 1, updated_at = NOW()
  WHERE user_id = p_user_id;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.refund_credit(UUID) FROM PUBLIC, anon, authenticated;
