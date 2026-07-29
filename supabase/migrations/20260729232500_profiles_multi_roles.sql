-- Migration d'ajout du champ role à la table profiles et du trigger auto-profile lors du signup Supabase.
--
-- Durcissement par rapport à la version initiale de cette migration (jamais
-- appliquée en base — corrigée avant son premier déploiement) : celle-ci
-- faisait `COALESCE(NEW.raw_user_meta_data->>'role', 'candidat')` sans
-- validation. raw_user_meta_data est intégralement fourni par le client au
-- signup (`options.data`) : n'importe qui pouvait s'inscrire avec
-- `role: "admin"` et obtenir un compte administrateur dès la création.
-- Ici, seuls 'candidat' et 'recruteur' sont acceptables depuis le signup ;
-- 'admin' ne peut être défini qu'en base directement (service_role).

-- 1. Ajout de la colonne role à public.profiles si elle n'existe pas
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'candidat' CHECK (role IN ('candidat', 'recruteur', 'admin'));

-- 2. Fonction trigger pour créer automatiquement la ligne profiles lors d'un nouveau signup auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  requested_role TEXT := NEW.raw_user_meta_data->>'role';
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE WHEN requested_role IN ('candidat', 'recruteur') THEN requested_role ELSE 'candidat' END,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Attachement du trigger sur auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Anti-escalade de privilège : une fois le profil créé, seul le service_role
-- (jamais exposé au navigateur) peut changer le rôle d'un utilisateur. Sans
-- ce garde-fou, la policy RLS existante sur profiles (auth.uid() = id, sans
-- restriction de colonne) permettrait à n'importe quel utilisateur connecté
-- de faire `supabase.from('profiles').update({ role: 'admin' })` sur sa
-- propre ligne. Le changement est silencieusement ignoré (pas d'exception),
-- pour ne pas casser les sauvegardes de profil classiques qui renvoient
-- accessoirement le même rôle.
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND auth.role() <> 'service_role' THEN
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_role_self_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_self_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_escalation();
