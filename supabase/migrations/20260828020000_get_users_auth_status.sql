-- =====================================================================
-- Statut d'authentification et de confirmation d'e-mail des utilisateurs
-- Accessible uniquement aux administrateurs (current_user_role() = 'admin')
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_users_auth_status()
RETURNS TABLE(user_id UUID, phone_masked TEXT, is_email_confirmed BOOLEAN, email_confirmed_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs.';
  END IF;

  RETURN QUERY
  SELECT 
    u.id AS user_id, 
    public.mask_phone_number(u.phone) AS phone_masked,
    (u.email_confirmed_at IS NOT NULL) AS is_email_confirmed,
    u.email_confirmed_at
  FROM auth.users u;
END;
$$;

REVOKE ALL ON FUNCTION public.get_users_auth_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_users_auth_status() TO authenticated;
