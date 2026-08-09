-- =====================================================================
-- Refonte "Sécurité & Connexion" — Section 3b, suppression à 30 jours.
-- =====================================================================

-- 1. orders/transactions étaient ON DELETE CASCADE + user_id NOT NULL —
-- supprimer un compte aurait silencieusement effacé son historique de
-- facturation. Détaché : les lignes survivent (montant, date, référence de
-- paiement conservés pour la comptabilité), seul le lien vers l'identité de
-- la personne disparaît.
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.orders DROP CONSTRAINT orders_user_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.transactions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.transactions DROP CONSTRAINT transactions_user_id_fkey;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Toutes les autres tables métier (resumes, candidatures, messages,
-- conversations, assistant_messages, badge_requests, interviews, job_offers,
-- cv_consultations, recruiter_profiles, ai_usage_daily, support_threads,
-- agent_assignments, subscriptions, profiles, user_roles) sont déjà
-- ON DELETE CASCADE depuis auth.users(id) — vérifié par introspection avant
-- d'écrire cette migration. La suppression réelle (job planifié, ci-dessous)
-- n'a donc qu'à supprimer la ligne auth.users : tout le reste suit
-- automatiquement, sauf orders/transactions qui survivent désormais.

-- 3. Date de suppression PRÉVUE (pas "supprimé le", malgré le nom — c'est le
-- nom demandé explicitement). Non NULL = suppression en attente, profil
-- masqué immédiatement (get_candidats_recherche/get_profils_publics
-- ci-dessous), annulable jusqu'à cette date.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.get_candidats_recherche()
RETURNS TABLE(id uuid, full_name text, headline text, bio text, city text, location text, skills jsonb, experiences jsonb, educations jsonb, avatar_url text, cv_url text, cv_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
SELECT
  id, full_name, headline, bio, city, location, skills, experiences,
  educations, avatar_url, cv_url, cv_name
FROM public.profiles
WHERE cv_visible_recruteurs = true
  AND deleted_at IS NULL
  AND NOT public.has_badge(id, 'verified_recruiter')
  AND is_test_account = COALESCE(
    (SELECT is_test_account FROM public.profiles caller WHERE caller.id = auth.uid()),
    false
  )
  AND (
    public.current_user_role() = 'admin'
    OR (public.current_user_role() = 'user' AND public.has_badge(auth.uid(), 'verified_recruiter'))
  );
$$;

CREATE OR REPLACE FUNCTION public.get_profils_publics()
RETURNS TABLE(id uuid, slug text, full_name text, headline text, bio text, avatar_url text, cover_url text, location text, city text, experiences jsonb, educations jsonb, pinned_details jsonb, badges jsonb, contact_email text, phone text, website_url text)
LANGUAGE sql
SET search_path TO 'public', 'pg_temp'
AS $$
SELECT
  id, slug, full_name, headline, bio, avatar_url, cover_url, location, city,
  experiences, educations, pinned_details, badges,
  CASE WHEN show_contact THEN contact_email ELSE NULL END AS contact_email,
  CASE WHEN show_contact THEN phone         ELSE NULL END AS phone,
  CASE WHEN show_contact THEN website_url   ELSE NULL END AS website_url
FROM public.profiles
WHERE is_public = true AND deleted_at IS NULL;
$$;

-- 4. Demande / annulation — self-service, RPC uniquement (profiles.deleted_at
-- n'est pas dans la liste des colonnes à GRANT UPDATE pour authenticated,
-- volontairement : seul ce chemin contrôlé peut le poser).
CREATE OR REPLACE FUNCTION public.request_own_account_deletion()
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_scheduled_at TIMESTAMPTZ := now() + interval '30 days';
BEGIN
  UPDATE public.profiles SET deleted_at = v_scheduled_at WHERE id = auth.uid();
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  PERFORM public.log_security_event('account_deletion_requested', 'warning', auth.uid(), NULL,
    jsonb_build_object('scheduled_at', v_scheduled_at));
  RETURN v_scheduled_at;
END;
$$;

REVOKE ALL ON FUNCTION public.request_own_account_deletion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_own_account_deletion() TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_own_account_deletion()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  UPDATE public.profiles SET deleted_at = NULL WHERE id = auth.uid() AND deleted_at IS NOT NULL;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  PERFORM public.log_security_event('account_deletion_cancelled', 'info', auth.uid(), NULL, '{}'::jsonb);
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_own_account_deletion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_own_account_deletion() TO authenticated;
