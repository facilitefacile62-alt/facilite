-- Photo/affiche d'offre d'emploi : colonne + bucket de stockage public dédié.
--
-- Contrairement à "resumes" (CV privés), les visuels d'offres sont destinés
-- à être vus par tout le monde (candidats parcourant les annonces) : bucket
-- PUBLIC dès la création, pas de Signed URL nécessaire ici.

ALTER TABLE public.job_offers
  ADD COLUMN IF NOT EXISTS image_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('job-offers', 'job-offers', true)
ON CONFLICT (id) DO NOTHING;

-- Lecture publique (candidats anonymes inclus, comme les offres elles-mêmes).
DROP POLICY IF EXISTS "Lecture publique des visuels d'offres" ON storage.objects;
CREATE POLICY "Lecture publique des visuels d'offres" ON storage.objects
  FOR SELECT USING (bucket_id = 'job-offers');

-- Écriture réservée aux recruteurs/admins, dans leur propre dossier
-- ({recruiter_id}/...) — même pattern que le bucket "resumes".
DROP POLICY IF EXISTS "Un recruteur televerse ses visuels d'offres" ON storage.objects;
CREATE POLICY "Un recruteur televerse ses visuels d'offres" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'job-offers'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.current_user_role() IN ('recruteur', 'admin')
  );

DROP POLICY IF EXISTS "Un recruteur met a jour ses visuels d'offres" ON storage.objects;
CREATE POLICY "Un recruteur met a jour ses visuels d'offres" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'job-offers' AND (storage.foldername(name))[1] = auth.uid()::text
  ) WITH CHECK (
    bucket_id = 'job-offers' AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Un recruteur supprime ses visuels d'offres" ON storage.objects;
CREATE POLICY "Un recruteur supprime ses visuels d'offres" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'job-offers' AND (storage.foldername(name))[1] = auth.uid()::text
  );
