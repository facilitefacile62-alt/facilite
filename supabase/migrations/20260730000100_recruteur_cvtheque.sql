-- =====================================================================
-- Espace Recruteur : CVthèque, offres d'emploi, et correctif RLS critique
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. CORRECTIF CRITIQUE : public.profiles était lisible par TOUT LE MONDE
-- ---------------------------------------------------------------------
-- La policy "Lecture publique des profils" (FOR SELECT USING (true)) exposait
-- email, phone, birth_date, gender, marital_status, driver_license et cv_url
-- de tous les utilisateurs, sans authentification. Elle contredit directement
-- la vue profils_publics (20260728200000_vue_profils_publics.sql), conçue
-- précisément pour éviter d'exposer profiles telle quelle. On revient à un
-- accès strictement privé, plus une lecture réservée aux admins.

DROP POLICY IF EXISTS "Lecture publique des profils" ON public.profiles;

DROP POLICY IF EXISTS "Lecture de son propre profil" ON public.profiles;
CREATE POLICY "Lecture de son propre profil" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Un admin lit tous les profils" ON public.profiles;
CREATE POLICY "Un admin lit tous les profils" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles admin_row WHERE admin_row.id = auth.uid() AND admin_row.role = 'admin')
  );


-- ---------------------------------------------------------------------
-- 2. Vue candidats_recherche : accès recruteur/admin, colonnes limitées
-- ---------------------------------------------------------------------
-- Même principe que profils_publics : la vue est la frontière de sécurité
-- (security_invoker = off), pas de policy "ouverte" sur profiles. Colonnes
-- volontairement absentes : email, phone, birth_date, gender,
-- marital_status, driver_license, cv_url brut (seule sa disponibilité,
-- has_cv, est exposée — l'URL réelle passe par une Signed URL générée à la
-- demande, jamais stockée en clair ici).

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
  AND EXISTS (
    SELECT 1 FROM public.profiles viewer
    WHERE viewer.id = auth.uid() AND viewer.role IN ('recruteur', 'admin')
  );

REVOKE ALL ON public.candidats_recherche FROM PUBLIC;
GRANT SELECT ON public.candidats_recherche TO authenticated;


-- ---------------------------------------------------------------------
-- 3. Storage : un recruteur/admin peut lire n'importe quel CV du bucket
-- ---------------------------------------------------------------------
-- Le bucket "resumes" est privé, policies existantes scopées au propriétaire
-- ((storage.foldername(name))[1] = auth.uid()::text) — un recruteur ne peut
-- donc pas générer de Signed URL pour le CV d'un candidat. Ajout ciblé,
-- cumulatif avec la policy existante (les policies RLS d'une même commande
-- sont combinées en OR).

DROP POLICY IF EXISTS "Recruteurs et admins lisent les CV" ON storage.objects;
CREATE POLICY "Recruteurs et admins lisent les CV" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'resumes'
    AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('recruteur', 'admin')
    )
  );


-- ---------------------------------------------------------------------
-- 4. Table job_offers
-- ---------------------------------------------------------------------
-- La table existe déjà (id, title, company, location, contract_type,
-- salary_range, description, is_active, created_at) : elle alimente déjà les
-- offres publiques affichées sur la page d'accueil, RLS activé, mais avec
-- seulement une policy SELECT ("Anyone can view active job offers") — aucune
-- policy INSERT/UPDATE/DELETE n'existe, donc aucune écriture client n'était
-- possible jusqu'ici. On l'étend plutôt que d'en créer une seconde en
-- parallèle : ajout de recruiter_id (NULL pour les offres déjà existantes,
-- publiées hors compte recruteur) et updated_at, puis les policies d'écriture
-- scopées au recruteur propriétaire.

ALTER TABLE public.job_offers
  ADD COLUMN IF NOT EXISTS recruiter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_offers_recruiter_id ON public.job_offers(recruiter_id);

DROP POLICY IF EXISTS "Un recruteur publie ses propres offres" ON public.job_offers;
CREATE POLICY "Un recruteur publie ses propres offres" ON public.job_offers
  FOR INSERT WITH CHECK (auth.uid() = recruiter_id);

DROP POLICY IF EXISTS "Un recruteur modifie ses propres offres" ON public.job_offers;
CREATE POLICY "Un recruteur modifie ses propres offres" ON public.job_offers
  FOR UPDATE USING (auth.uid() = recruiter_id) WITH CHECK (auth.uid() = recruiter_id);

DROP POLICY IF EXISTS "Un recruteur supprime ses propres offres" ON public.job_offers;
CREATE POLICY "Un recruteur supprime ses propres offres" ON public.job_offers
  FOR DELETE USING (auth.uid() = recruiter_id);

-- Pas de trigger pour updated_at : public.update_updated_at_column()
-- n'existe pas réellement en base (seule la variante interne storage.* existe
-- — vérifié en interrogeant pg_proc). Comme partout ailleurs dans ce projet
-- (profil/page.js, admin/page.js...), updated_at est renseigné manuellement
-- par le code applicatif à chaque écriture.
