-- =====================================================================
-- INCIDENT 2026-08-06 : bucket Storage "resumes" trouvé public=true
-- 45 CV réels de candidats étaient accessibles par URL directe sans
-- authentification. Voir docs/incident-2026-08-06.md pour la chronologie
-- complète. Cette migration documente la remédiation immédiate, déjà
-- appliquée en base au moment de l'incident (bascule public=false), et
-- ferme les deux angles morts trouvés en creusant.
-- =====================================================================

-- 1. Le bucket doit être privé. Idempotent : déjà appliqué en urgence via
--    `supabase db query --linked`, répété ici pour que la migration reste
--    la source de vérité reproductible depuis zéro.
UPDATE storage.buckets SET public = false WHERE id = 'resumes';

-- 2. Une ligne historique de public.resumes stockait encore une URL
--    publique complète au lieu d'un chemin (comportement hérité, prévu et
--    toléré par getSignedCvUrl() dans src/lib/supabase.js, mais qui ne
--    signera jamais correctement puisque ce n'est pas un chemin). Conversion
--    en chemin relatif au bucket pour qu'elle bénéficie de createSignedUrl()
--    comme toutes les autres.
UPDATE public.resumes
SET file_url = regexp_replace(file_url, '^https?://[^/]+/storage/v1/object/public/resumes/', '')
WHERE file_url LIKE '%/storage/v1/object/public/resumes/%';

-- 3. La policy de lecture recruteur/admin autorisait TOUT recruteur badgé à
--    lire N'IMPORTE QUEL CV, sans vérifier aucune autorisation du candidat.
--    Un recruteur badgé pouvait donc lire le CV d'un parfait inconnu,
--    simplement en devinant/énumérant un chemin. Un admin garde un accès
--    total (modération) ; le propriétaire garde le sien (déjà couvert par
--    "Lecture de son propre CV", répété ici en OR pour ne pas dépendre de
--    l'autre policy).
--
--    Deux formes d'autorisation légitimes coexistent dans le produit, pas
--    une seule — la première ébauche de cette migration n'en couvrait
--    qu'une et aurait cassé l'autre en la retirant :
--      a) le candidat a activé profiles.cv_visible_recruteurs (visible dans
--         le fil de CV/recherche, cf. get_candidats_recherche()) ;
--      b) le candidat a postulé à une offre de CE recruteur précis
--         (public.candidatures.recruiter_id = auth.uid()), indépendamment
--         de son réglage de visibilité générale — postuler EST un acte
--         d'autorisation envers ce recruteur-là.
DROP POLICY IF EXISTS "Recruteurs et admins lisent les CV" ON storage.objects;
CREATE POLICY "Recruteurs et admins lisent les CV" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (
      auth.uid() = owner
      OR public.current_user_role() = 'admin'
      OR (
        public.current_user_role() = 'user'
        AND public.has_badge(auth.uid(), 'verified_recruiter')
        AND (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id::text = (storage.foldername(storage.objects.name))[1]
              AND p.cv_visible_recruteurs = true
          )
          OR EXISTS (
            SELECT 1 FROM public.candidatures c
            WHERE c.user_id::text = (storage.foldername(storage.objects.name))[1]
              AND c.recruiter_id = auth.uid()
          )
        )
      )
    )
  );
