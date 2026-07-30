-- Étape 2 : Espace Vitrine & Gestion des Recruteurs.
--
-- Décision architecturale (validée explicitement) : réutilise job_offers /
-- candidatures plutôt que de créer des tables job_posters / applications
-- dupliquées — ces deux tables couvrent déjà exactement le même besoin
-- (title, image_url, min_education_level, is_active, embedding pour
-- job_offers ; job_offer_id, user_id, status pour candidatures), et sont
-- déjà branchées sur /recruteur, /offres et la recherche sémantique
-- (match_job_offers). Dupliquer aurait fragmenté les données et la
-- recherche entre deux systèmes de publication d'offres parallèles.
--
-- Seule partie réellement nouvelle : recruiter_profiles (informations de
-- marque — logo, bannière, secteur — absentes de `profiles`).

-- 1. Profil "vitrine" du recruteur, distinct de profiles (infos de marque
-- entreprise, pas de compte utilisateur).
CREATE TABLE IF NOT EXISTS public.recruiter_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  sector TEXT,
  location TEXT DEFAULT 'Dakar, Sénégal',
  logo_url TEXT,
  banner_url TEXT,
  description TEXT,
  website TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recruiter_profiles ENABLE ROW LEVEL SECURITY;

-- Vitrine publique : lecture ouverte à tous, écriture réservée au propriétaire.
DROP POLICY IF EXISTS "Lecture publique des profils recruteurs" ON public.recruiter_profiles;
CREATE POLICY "Lecture publique des profils recruteurs"
  ON public.recruiter_profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Un recruteur cree son propre profil vitrine" ON public.recruiter_profiles;
CREATE POLICY "Un recruteur cree son propre profil vitrine"
  ON public.recruiter_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Un recruteur modifie son propre profil vitrine" ON public.recruiter_profiles;
CREATE POLICY "Un recruteur modifie son propre profil vitrine"
  ON public.recruiter_profiles FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Un recruteur supprime son propre profil vitrine" ON public.recruiter_profiles;
CREATE POLICY "Un recruteur supprime son propre profil vitrine"
  ON public.recruiter_profiles FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS recruiter_profiles_user_id_idx ON public.recruiter_profiles(user_id);

-- updated_at automatique, même pattern que le reste du schéma.
CREATE OR REPLACE FUNCTION public.set_recruiter_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recruiter_profiles_updated_at ON public.recruiter_profiles;
CREATE TRIGGER trg_recruiter_profiles_updated_at
  BEFORE UPDATE ON public.recruiter_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_recruiter_profiles_updated_at();

-- 2. job_offers.deadline — seule colonne "job_posters" réellement absente
-- de job_offers (min_education_level, image_url, is_active, embedding
-- existent déjà depuis les migrations précédentes).
ALTER TABLE public.job_offers ADD COLUMN IF NOT EXISTS deadline DATE;

-- 3. candidatures.status : aucune contrainte n'existait jusqu'ici (colonne
-- texte libre). Une seule valeur en usage actuellement ('pending') : sûr
-- d'ajouter la contrainte sans casser de données existantes. 'reviewed'
-- ajouté pour distinguer "vue par le recruteur" de "en attente".
ALTER TABLE public.candidatures DROP CONSTRAINT IF EXISTS candidatures_status_check;
ALTER TABLE public.candidatures ADD CONSTRAINT candidatures_status_check
  CHECK (status IN ('pending', 'reviewed', 'accepted', 'rejected'));

-- Storage : le bucket "job-offers" et ses policies (lecture publique,
-- écriture réservée au recruteur propriétaire du dossier) existent déjà
-- depuis une migration précédente — rien à ajouter ici.
