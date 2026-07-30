-- Corrige une récursion infinie (erreur Postgres 42P17) introduite par la
-- migration précédente.
--
-- "Un admin lit tous les profils" (SELECT) et "Un admin gere tous les
-- profils" (UPDATE) vérifient le rôle de l'appelant via
-- `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')`.
-- Ce sous-select est lui-même un SELECT sur profiles : Postgres doit donc
-- réévaluer TOUTES les policies SELECT de la table pour l'autoriser — y
-- compris celle en cours d'évaluation. Boucle infinie.
--
-- Tant que la seule policy SELECT était "Lecture publique des profils"
-- (USING (true), pas de sous-requête), le problème ne pouvait pas se
-- produire — c'est pour ça qu'il n'était pas visible avant la migration
-- précédente qui a retiré cette policy trop permissive.
--
-- Solution standard : une fonction SECURITY DEFINER. Son corps s'exécute
-- avec les privilèges du propriétaire de la fonction, qui contournent le RLS
-- pour cette requête interne — donc plus de réévaluation récursive des
-- policies de profiles.

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

DROP POLICY IF EXISTS "Un admin lit tous les profils" ON public.profiles;
CREATE POLICY "Un admin lit tous les profils" ON public.profiles
  FOR SELECT USING (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Un admin gere tous les profils" ON public.profiles;
CREATE POLICY "Un admin gere tous les profils" ON public.profiles
  FOR UPDATE USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- candidats_recherche s'exécute déjà en security_invoker = off (bypass RLS
-- de fait), donc pas de récursion possible ici — mais on la réécrit avec la
-- même fonction par cohérence et pour ne pas dépendre implicitement de ce
-- détail de privilège.
DROP VIEW IF EXISTS public.candidats_recherche;
CREATE VIEW public.candidats_recherche
WITH (security_invoker = off) AS
SELECT
  id,
  full_name,
  headline,
  bio,
  city,
  location,
  skills,
  experiences,
  educations,
  avatar_url,
  cv_url,
  cv_name
FROM public.profiles
WHERE role = 'candidat'
  AND public.current_user_role() IN ('recruteur', 'admin');

REVOKE ALL ON public.candidats_recherche FROM PUBLIC;
GRANT SELECT ON public.candidats_recherche TO authenticated;

-- Policy storage : même sous-select sur profiles, mais storage.objects est
-- une table différente de profiles — pas de récursion directe possible ici.
-- Réécrite avec la fonction quand même, par cohérence et parce que c'est
-- strictement équivalent mais moins coûteux (fonction STABLE vs sous-select
-- répété par ligne).
DROP POLICY IF EXISTS "Recruteurs et admins lisent les CV" ON storage.objects;
CREATE POLICY "Recruteurs et admins lisent les CV" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'resumes' AND public.current_user_role() IN ('recruteur', 'admin')
  );
