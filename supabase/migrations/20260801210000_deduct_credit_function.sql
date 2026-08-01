-- Déduction atomique d'un crédit : l'API REST de PostgREST n'expose pas
-- d'expression SQL du type "credits = credits - 1" via .update() côté
-- client, seulement des valeurs littérales — un read-then-write depuis le
-- code applicatif serait vulnérable à une race condition entre deux appels
-- IA concurrents du même utilisateur (double dépense). La clause
-- WHERE credits > 0 dans l'UPDATE rend la transition atomique au niveau de
-- la ligne Postgres, comme déjà pratiqué pour l'idempotence du webhook KPay
-- (payment_status pending -> paid).
CREATE OR REPLACE FUNCTION public.deduct_credit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  rows_affected INT;
BEGIN
  UPDATE public.subscriptions
  SET credits = credits - 1, updated_at = NOW()
  WHERE user_id = p_user_id AND credits > 0;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- SECURITY DEFINER + pas de GRANT à "authenticated" : appelable uniquement
-- via un client service_role (nos routes serveur), jamais directement par
-- le navigateur — un utilisateur ne doit pas pouvoir invoquer cette
-- fonction pour lui-même sans passer par le garde-fou applicatif (vérifier
-- QUOI il paie avant de déduire).
REVOKE ALL ON FUNCTION public.deduct_credit(UUID) FROM PUBLIC, anon, authenticated;
