-- =====================================================================
-- Refonte "Sécurité & Connexion" — Section 3, désactivation self-service.
--
-- user_roles.status='suspended' existait déjà (suspension admin), mais ne
-- distinguait pas "l'utilisateur s'est désactivé lui-même" de "un admin l'a
-- suspendu" — nécessaire pour que seule l'auto-désactivation se réactive
-- automatiquement à la reconnexion (src/middleware.js) : une suspension
-- admin ne doit JAMAIS se lever toute seule, ce serait un contournement de
-- la modération.
-- =====================================================================

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.user_roles.suspended_by IS
  'NULL = auto-désactivation par le titulaire du compte (réactivée automatiquement à la reconnexion, voir middleware.js). Non NULL = suspension par un admin (jamais réactivée automatiquement).';

-- Auto-désactivation : status='suspended' AVEC suspended_by=NULL, pour se
-- distinguer d'une suspension admin. Aucun GRANT UPDATE direct sur
-- user_roles pour authenticated (colonnes verrouillées, cf. rbac.js) : seul
-- ce chemin RPC peut le faire, et uniquement sur SA PROPRE ligne (auth.uid()).
CREATE OR REPLACE FUNCTION public.deactivate_own_account()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  UPDATE public.user_roles
  SET status = 'suspended', suspended_by = NULL, updated_at = now()
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  PERFORM public.log_security_event('account_self_deactivated', 'info', auth.uid(), NULL, '{}'::jsonb);
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.deactivate_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deactivate_own_account() TO authenticated;

-- Réactivation automatique — appelée depuis middleware.js au moment où un
-- compte suspendu tente d'accéder à une page protégée : remplace le
-- sign-out immédiat existant UNIQUEMENT quand suspended_by IS NULL (auto-
-- désactivation). Une suspension admin (suspended_by rempli) continue de
-- forcer la déconnexion, comportement inchangé.
CREATE OR REPLACE FUNCTION public.reactivate_own_account_if_self_suspended()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  UPDATE public.user_roles
  SET status = 'active', updated_at = now()
  WHERE user_id = auth.uid() AND status = 'suspended' AND suspended_by IS NULL;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  PERFORM public.log_security_event('account_self_reactivated', 'info', auth.uid(), NULL, '{}'::jsonb);
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.reactivate_own_account_if_self_suspended() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reactivate_own_account_if_self_suspended() TO authenticated;
