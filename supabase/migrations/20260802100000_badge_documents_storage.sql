-- Bucket privé dédié aux pièces justificatives des demandes de badge
-- (NINEA, RCCM, attestations). Jamais public : ces documents identifient
-- une entreprise réelle, contrairement aux CV déjà publics/semi-publics
-- ailleurs dans le projet.

INSERT INTO storage.buckets (id, name, public)
VALUES ('badge-documents', 'badge-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Chemin attendu : {user_id}/{request_id}/{filename} — le préfixe
-- {user_id} permet à la policy INSERT de vérifier la propriété avec
-- storage.foldername(name)[1], comme déjà pratiqué pour le bucket "resumes"
-- (20260728180000_durcissement_securite_rls_storage.sql).

DROP POLICY IF EXISTS "Upload de ses propres documents de badge" ON storage.objects;
CREATE POLICY "Upload de ses propres documents de badge" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'badge-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Lecture de ses propres documents de badge" ON storage.objects;
CREATE POLICY "Lecture de ses propres documents de badge" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'badge-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Lecture admin/publisher (modération des demandes, section 5) : jamais le
-- reste des utilisateurs, ces documents ne sont montrés à personne d'autre
-- que leur propriétaire et les modérateurs.
DROP POLICY IF EXISTS "Un moderateur lit les documents de badge" ON storage.objects;
CREATE POLICY "Un moderateur lit les documents de badge" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'badge-documents' AND public.current_user_role() IN ('admin', 'publisher'));

-- Pas de policy DELETE authenticated : la suppression se fait uniquement
-- via le job de purge (service_role, cf. /api/cron/purge-badge-documents),
-- jamais par le déposant lui-même une fois la demande soumise — on garde
-- la trace de la vérification jusqu'à la purge planifiée, pas seulement
-- jusqu'à ce que l'utilisateur change d'avis.
