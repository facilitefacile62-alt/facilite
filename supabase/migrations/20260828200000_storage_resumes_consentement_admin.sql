-- Bucket Storage `resumes` : soumettre l'accès administrateur au
-- consentement du candidat, comme l'est déjà la table public.resumes.
--
-- Le consentement n'était appliqué qu'à MOITIÉ. La policy « Un admin lit
-- tous les CV » sur public.resumes appelle bien
-- can_admin_read_document(user_id, auth.uid()), qui exige une ligne
-- document_access_requests au statut 'approved' et non expirée. Mais la
-- policy de lecture du bucket accordait, elle, un SELECT INCONDITIONNEL dès
-- que current_user_role() = 'admin'.
--
-- Un administrateur ne pouvait donc pas LISTER les CV d'un candidat sans son
-- accord, mais pouvait TÉLÉCHARGER n'importe quel fichier directement depuis
-- le Storage. C'est la forme exacte de l'incident du 2026-08-18 : une règle
-- posée à un endroit, contournable à l'autre.
--
-- Le contrôle passe désormais par la même fonction, pour qu'il n'existe
-- qu'une seule définition de « cet admin a-t-il le droit de voir ce
-- document ». Le passage par une jointure sur profiles, plutôt qu'un
-- ((storage.foldername(name))[1])::uuid, est délibéré : sur les 139 objets
-- du bucket, 40 sont rangés sous « cvs/ » et « documents/ » et non sous un
-- UUID (vérifié le 2026-08-28). Un cast direct lèverait une erreur sur ces
-- objets et ferait échouer toute la policy — donc toute lecture du bucket,
-- y compris par le propriétaire. La jointure ne trouve simplement aucune
-- ligne pour ces chemins, ce qui ferme l'accès plutôt que de le casser.
-- C'est aussi la forme qu'emploie déjà la branche recruteur juste en
-- dessous, inchangée par cette migration.

DROP POLICY IF EXISTS "Recruteurs et admins lisent les CV" ON storage.objects;

CREATE POLICY "Recruteurs et admins lisent les CV" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'resumes'
    AND (
      -- Le candidat lui-même, inchangé.
      auth.uid() = owner

      -- Administrateur : uniquement si le candidat a donné son accord.
      OR (
        public.current_user_role() = 'admin'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id::text = (storage.foldername(objects.name))[1]
            AND public.can_admin_read_document(p.id, auth.uid())
        )
      )

      -- Recruteur vérifié, inchangé : CV rendu visible aux recruteurs par le
      -- candidat, ou candidature adressée à ce recruteur précis.
      OR (
        public.current_user_role() = 'user'
        AND public.has_badge(auth.uid(), 'verified_recruiter')
        AND (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id::text = (storage.foldername(objects.name))[1]
              AND p.cv_visible_recruteurs = true
          )
          OR EXISTS (
            SELECT 1 FROM public.candidatures c
            WHERE c.user_id::text = (storage.foldername(objects.name))[1]
              AND c.recruiter_id = auth.uid()
          )
        )
      )
    )
  );
