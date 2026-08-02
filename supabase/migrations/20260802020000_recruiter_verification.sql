-- Audit sécurité (référentiel 101-150, points 121+122) : n'importe qui
-- pouvait s'inscrire comme recruteur et interroger candidats_recherche
-- immédiatement, sans aucune vérification — exfiltration en une requête de
-- l'annuaire complet des candidats (nom, bio, ville, compétences, URL de
-- CV). Ajoute une étape de validation manuelle admin avant qu'un compte
-- recruteur n'accède au répertoire candidats.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS recruiter_verified BOOLEAN NOT NULL DEFAULT false;

-- Grandfathering : les comptes recruteurs déjà en place (démo + éventuels
-- recruteurs réels créés avant ce correctif) ne doivent pas se retrouver
-- bloqués rétroactivement par ce durcissement — seuls les NOUVEAUX comptes
-- recruteurs partent désormais en attente de validation.
UPDATE public.profiles SET recruiter_verified = true WHERE role = 'recruteur';

-- Même pattern que current_user_role() (voir 20260730000200) et pour la même
-- raison : un sous-select direct sur profiles dans une policy/vue RLS
-- réévalue récursivement les policies SELECT de profiles. SECURITY DEFINER
-- contourne cette récursion.
CREATE OR REPLACE FUNCTION public.current_user_recruiter_verified()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(recruiter_verified, false) FROM public.profiles WHERE id = auth.uid();
$$;

-- Le répertoire candidats n'est désormais visible qu'aux recruteurs validés
-- (les admins gardent un accès total, comme avant ce correctif).
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
  AND (
    public.current_user_role() = 'admin'
    OR (public.current_user_role() = 'recruteur' AND public.current_user_recruiter_verified())
  );

REVOKE ALL ON public.candidats_recherche FROM PUBLIC;
GRANT SELECT ON public.candidats_recherche TO authenticated;
