-- Migration pour créer la fonction RPC resolve_admin_id
-- Permet de récupérer l'ID de l'admin sans être bloqué par les policies RLS de la table profiles

CREATE OR REPLACE FUNCTION public.resolve_admin_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM public.profiles 
  WHERE role = 'admin' 
  ORDER BY created_at ASC 
  LIMIT 1;
$$;
