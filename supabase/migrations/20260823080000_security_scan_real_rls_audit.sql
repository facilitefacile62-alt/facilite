-- Correction du panneau admin "Lab Sécurité & Failles" (2026-08-23).
--
-- Résultat brut constaté : /api/admin/security-scan/route.js vérifiait la
-- RLS via supabaseAdmin.from(table).select(...) — le client SERVICE_ROLE,
-- qui CONTOURNE la RLS par construction. Cette vérification ne pouvait donc
-- jamais détecter une vraie régression RLS, quel que soit le résultat.
-- get_rls_audit() interroge directement pg_class/pg_policy (même requête
-- que l'Invariant 2 de tests/security/invariants.spec.js) — c'est la seule
-- façon de lire l'état réel de la RLS depuis un rôle qui, par définition,
-- n'y est jamais soumis. Couvre TOUTES les tables de public, pas une liste
-- de 12 tables codée en dur (qui contenait déjà un nom erroné,
-- "chat_messages" au lieu de "messages").
CREATE OR REPLACE FUNCTION public.get_rls_audit()
RETURNS TABLE(table_name TEXT, rls_enabled BOOLEAN, policy_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs.';
  END IF;

  RETURN QUERY
  SELECT c.relname::TEXT, c.relrowsecurity, count(p.polname)
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_policy p ON p.polrelid = c.oid
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  GROUP BY c.relname, c.relrowsecurity
  ORDER BY c.relname;
END;
$$;

REVOKE ALL ON FUNCTION public.get_rls_audit() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_rls_audit() TO authenticated;
