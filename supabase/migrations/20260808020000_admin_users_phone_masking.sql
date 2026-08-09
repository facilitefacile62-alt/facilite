-- =====================================================================
-- Onglet Utilisateurs (admin) : affichage + dissociation du numéro de
-- téléphone (auth.users.phone, utilisé pour la connexion SMS/OTP) —
-- jamais public.profiles.phone (un champ de contact distinct, non lié à
-- l'authentification).
--
-- Le numéro complet ne doit jamais quitter la base en clair : le masquage
-- est fait ICI, en SQL, pas côté client — un client compromis ne peut donc
-- jamais observer le numéro complet, même en inspectant le réseau.
-- =====================================================================

-- Masquage générique, indépendant de la longueur réelle de la partie
-- masquée (toujours "*** **", jamais un nombre d'astérisques proportionnel
-- au numéro réel) pour ne pas laisser fuiter sa longueur exacte.
CREATE OR REPLACE FUNCTION public.mask_phone_number(p_phone TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE
    WHEN p_phone IS NULL OR length(p_phone) < 8 THEN NULL
    ELSE substring(p_phone FROM 1 FOR 4) || ' ' || substring(p_phone FROM 5 FOR 2) || ' *** ** ' || right(p_phone, 2)
  END;
$$;

REVOKE ALL ON FUNCTION public.mask_phone_number(TEXT) FROM PUBLIC;
-- service_role uniquement : appelée en interne par get_users_phone_status()
-- (droits du propriétaire, aucun GRANT requis pour cet appel-là) et par la
-- route API de dissociation (src/app/api/admin/users/[id]/phone/route.js)
-- pour calculer la version journalisée dans security_logs.
GRANT EXECUTE ON FUNCTION public.mask_phone_number(TEXT) TO service_role;

-- Numéros masqués de tous les comptes ayant un téléphone associé — admin
-- uniquement, même garde-fou que get_security_alert_history/
-- resolve_security_alert (20260807120000).
CREATE OR REPLACE FUNCTION public.get_users_phone_status()
RETURNS TABLE(user_id UUID, phone_masked TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs.';
  END IF;

  RETURN QUERY
  SELECT u.id, public.mask_phone_number(u.phone)
  FROM auth.users u
  WHERE u.phone IS NOT NULL AND u.phone <> '';
END;
$$;

REVOKE ALL ON FUNCTION public.get_users_phone_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_users_phone_status() TO authenticated;
