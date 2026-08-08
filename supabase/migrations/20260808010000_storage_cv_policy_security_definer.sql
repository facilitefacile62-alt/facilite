-- =====================================================================
-- Corrige la policy storage.objects "Recruteurs et admins lisent les CV"
-- — même famille de bug que les Décisions 1 et 3 (2026-08-08), mais dans
-- une policy RLS plutôt qu'une fonction : les sous-requêtes EXISTS de la
-- policy interrogent profiles/candidatures, deux tables protégées par
-- RLS, filtrées à "sa propre ligne" pour un utilisateur non-admin — le
-- recruteur qui évalue la policy ne peut voir ni le profil du candidat
-- (branche cv_visible_recruteurs), ni sa propre ligne candidatures
-- (branche candidature). Les deux EXISTS renvoient donc systématiquement
-- faux, quelle que soit la donnée réelle. Vérifié en direct sur
-- facilite-e2e-test le 2026-08-08 : recruteur badgé, candidature
-- existante ET cv_visible_recruteurs=true simultanément → échec
-- ("Object not found").
--
-- Correctif : extrait le test dans une fonction SECURITY DEFINER dédiée
-- (même principe que has_badge()/is_admin()), appelée depuis la policy.
-- Une policy RLS ne peut pas elle-même être SECURITY DEFINER (ce n'est
-- pas une fonction) — la fonction qu'elle appelle, si.
--
-- can_recruiter_read_cv() couvre les deux mêmes cas légitimes que
-- l'ancienne policy, sans changement de logique métier :
--   A. cv_visible_recruteurs = true sur le profil du candidat
--   B. Une ligne candidatures lie ce candidat à CE recruteur
--      (candidatures.recruiter_id = recruiter_id, condition directe,
--      SANS jointure job_offers — fidèle à l'EXISTS d'origine, qui ne
--      passait jamais par job_offers ; une jointure aurait exclu les
--      candidatures avec recruiter_id direct mais sans job_offer_id).
-- Les deux restent conditionnées à has_badge(recruiter_id,
-- 'verified_recruiter') À L'INTÉRIEUR de la fonction — sans ce garde,
-- n'importe quel utilisateur authentifié (pas seulement un recruteur
-- badgé) pourrait lire un CV via la branche A dès que
-- cv_visible_recruteurs=true, ce que l'ancienne policy interdisait déjà
-- via current_user_role()='user' AND has_badge(...).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.can_recruiter_read_cv(
  candidate_id uuid,
  recruiter_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.has_badge(recruiter_id, 'verified_recruiter')
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = candidate_id
      AND p.cv_visible_recruteurs = true
    )
    OR EXISTS (
      SELECT 1 FROM public.candidatures c
      WHERE c.user_id = candidate_id
      AND c.recruiter_id = recruiter_id
    )
  );
$$;

DROP POLICY IF EXISTS "Recruteurs et admins lisent les CV" ON storage.objects;
CREATE POLICY "Recruteurs et admins lisent les CV" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (
      auth.uid() = owner
      OR public.can_recruiter_read_cv(owner, auth.uid())
      OR public.is_admin(auth.uid())
    )
  );
