-- Section 6 du chantier RBAC : journal d'audit append-only.
--
-- INSERT autorisé (via service_role uniquement — voir plus bas),
-- UPDATE/DELETE révoqués pour TOUS les rôles, admin compris : un journal
-- d'audit modifiable après coup ne prouve rien. Aucune exception pour
-- "admin" ici, contrairement à user_roles/badge_requests — c'est
-- volontaire, un admin malveillant ou compromis ne doit pas pouvoir
-- effacer ses propres traces.

CREATE TABLE IF NOT EXISTS public.security_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_logs_target_user ON public.security_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON public.security_logs(created_at DESC);

ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

-- Aucun GRANT INSERT/UPDATE/DELETE à authenticated/anon : seul service_role
-- écrit (toujours via log_security_event() ci-dessous, jamais un INSERT
-- direct depuis une route — even nos propres routes admin ne doivent pas
-- pouvoir écrire un log arbitraire, seulement via cette fonction qui fixe
-- actor_id/created_at côté serveur).
REVOKE INSERT, UPDATE, DELETE ON public.security_logs FROM authenticated, anon;

-- is_admin(user_id) : signature demandée explicitement (user_id en
-- paramètre, pas seulement "current user") — utile pour qu'un admin
-- puisse aussi vérifier le statut d'un AUTRE compte dans une policy ou une
-- route, pas seulement le sien. SECURITY DEFINER + search_path='' même
-- raisonnement anti-récursion que current_user_role() (20260802050000).
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = check_user_id AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "Seuls les admins lisent les logs" ON public.security_logs;
CREATE POLICY "Seuls les admins lisent les logs" ON public.security_logs
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Point d'écriture unique. p_actor_id est un paramètre explicite plutôt que
-- auth.uid() : cette fonction est appelée depuis des routes serveur via le
-- client service_role (getSupabaseAdmin()), une connexion sans JWT
-- utilisateur — auth.uid() y renverrait NULL, pas l'admin qui a réellement
-- déclenché l'action. L'appelant (route serveur) passe l'ID déjà vérifié
-- par requireUser(), jamais une valeur fournie brute par le navigateur.
-- REVOKE EXECUTE de authenticated/anon quand même (même schéma que
-- deduct_credit/increment_ai_usage) : seul le code serveur doit pouvoir
-- journaliser, jamais un appel direct depuis le navigateur.
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type TEXT,
  p_severity TEXT,
  p_actor_id UUID,
  p_target_user_id UUID,
  p_details JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO public.security_logs (event_type, severity, actor_id, target_user_id, details)
  VALUES (p_event_type, p_severity, p_actor_id, p_target_user_id, COALESCE(p_details, '{}'::jsonb))
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_security_event(TEXT, TEXT, UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
