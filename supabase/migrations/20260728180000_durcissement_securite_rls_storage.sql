-- =====================================================================
-- Durcissement de sécurité — suite à l'audit du 2026-07-28
-- =====================================================================
-- Corrige trois failles identifiées :
--   1. public.resumes    : la clause "OR user_id IS NULL" ouvrait la lecture
--                          ET l'écriture des lignes orphelines à n'importe
--                          quel visiteur anonyme muni de la clé anon.
--   2. public.applications : RLS actif mais une seule policy INSERT
--                          WITH CHECK (true) — dépôt anonyme illimité, et
--                          aucune policy SELECT (données irrécupérables).
--   3. storage "resumes" : bucket public + SELECT ouvert à tous — tous les
--                          CV (nom, adresse, téléphone, date de naissance)
--                          téléchargeables par simple URL devinable.
--
-- ATTENTION : l'étape 1 SUPPRIME les lignes orphelines de public.resumes.
-- Pour les dénombrer au préalable :
--   SELECT count(*) FROM public.resumes WHERE user_id IS NULL;
-- Ces lignes sont de toute façon inaccessibles à tout utilisateur légitime
-- une fois la policy durcie : plus personne ne peut les lire ni les revendiquer.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TABLE public.resumes
-- ---------------------------------------------------------------------

DELETE FROM public.resumes WHERE user_id IS NULL;

ALTER TABLE public.resumes ALTER COLUMN user_id SET NOT NULL;

DROP POLICY IF EXISTS "User resumes policy" ON public.resumes;
DROP POLICY IF EXISTS "Lecture de ses propres CV" ON public.resumes;
DROP POLICY IF EXISTS "Creation de ses propres CV" ON public.resumes;
DROP POLICY IF EXISTS "Modification de ses propres CV" ON public.resumes;
DROP POLICY IF EXISTS "Suppression de ses propres CV" ON public.resumes;

CREATE POLICY "Lecture de ses propres CV" ON public.resumes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Creation de ses propres CV" ON public.resumes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Modification de ses propres CV" ON public.resumes
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Suppression de ses propres CV" ON public.resumes
  FOR DELETE USING (auth.uid() = user_id);


-- ---------------------------------------------------------------------
-- 2. TABLE public.applications
-- ---------------------------------------------------------------------
-- Choix retenu : dépôt réservé aux utilisateurs AUTHENTIFIÉS, en leur propre
-- nom. Si les candidatures anonymes redeviennent un besoin métier, remplacer
-- la policy INSERT par WITH CHECK (true) MAIS ajouter impérativement un
-- CAPTCHA et un rate limiting, sans quoi la faille de spam illimité revient.

DROP POLICY IF EXISTS "Anyone can submit an application" ON public.applications;
DROP POLICY IF EXISTS "Depot de sa propre candidature" ON public.applications;
DROP POLICY IF EXISTS "Lecture de ses propres candidatures" ON public.applications;
DROP POLICY IF EXISTS "Modification de ses propres candidatures" ON public.applications;
DROP POLICY IF EXISTS "Suppression de ses propres candidatures" ON public.applications;

CREATE POLICY "Depot de sa propre candidature" ON public.applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Lecture de ses propres candidatures" ON public.applications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Modification de ses propres candidatures" ON public.applications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Suppression de ses propres candidatures" ON public.applications
  FOR DELETE USING (auth.uid() = user_id);


-- ---------------------------------------------------------------------
-- 3. BUCKET DE STOCKAGE "resumes"
-- ---------------------------------------------------------------------
-- Le bucket passe en privé : l'application DOIT désormais utiliser
-- createSignedUrl() et non plus getPublicUrl() (déjà fait côté code).
--
-- Les chemins sont normalisés en {user_id}/cvs/... et {user_id}/documents/...
-- Le 1er segment du chemin porte donc l'identité du propriétaire.
-- L'ancienne policy validait split_part(storage.filename(name), '_', 1),
-- c'est-à-dire le NOM DE FICHIER seul : elle était déjà cassée pour les
-- fichiers préfixés "doc_ocr_..." (split_part renvoyait "doc").

UPDATE storage.buckets SET public = false WHERE id = 'resumes';

DROP POLICY IF EXISTS "Lecture publique des CV" ON storage.objects;
DROP POLICY IF EXISTS "Lecture de son propre CV" ON storage.objects;
DROP POLICY IF EXISTS "Upload de son propre CV" ON storage.objects;
DROP POLICY IF EXISTS "Mise a jour de son propre CV" ON storage.objects;
DROP POLICY IF EXISTS "Suppression de son propre CV" ON storage.objects;

CREATE POLICY "Lecture de son propre CV" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Upload de son propre CV" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Mise a jour de son propre CV" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text
  ) WITH CHECK (
    bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Suppression de son propre CV" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text
  );
