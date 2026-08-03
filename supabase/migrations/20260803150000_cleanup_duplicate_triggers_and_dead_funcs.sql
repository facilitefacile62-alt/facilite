-- Nettoyage des objets obsolètes et doublons de déclencheurs en base de données.
-- 1. Suppression du trigger doublon on_auth_user_created_create_profile (on_auth_user_created est le trigger canonique).
DROP TRIGGER IF EXISTS on_auth_user_created_create_profile ON auth.users;

-- 2. Suppression du trigger d'auto-confirmation obsolète on_auth_user_created_auto_confirm.
DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;

-- 3. Suppression des fonctions mortes/obsolètes associées.
DROP FUNCTION IF EXISTS public.auto_confirm_user();
DROP FUNCTION IF EXISTS public.auto_confirm_user_on_signup();
