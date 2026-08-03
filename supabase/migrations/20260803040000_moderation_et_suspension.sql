-- =====================================================================
-- ÉTAPE 3 du chantier — modération des offres + suspension de compte
-- réellement effective au niveau PostgreSQL.
-- =====================================================================

-- 1. SUSPENSION — current_user_role() est LE point de passage de quasi
-- toute action privilégiée dans ce schéma (admin, badges, modération...).
-- Le faire renvoyer NULL pour un compte non 'active' bloque d'un seul coup
-- toutes les policies qui en dépendent, sans retoucher chacune séparément.
-- Ne verrouille PAS les policies purement "auth.uid() = propriétaire" (ex.
-- lire son propre profil) — un compte suspendu perd tout accès privilégié
-- immédiatement, mais garde un accès en lecture à ses propres données de
-- base. Documenté explicitement, pas une prétention de verrouillage total.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE WHEN status = 'active' THEN role ELSE NULL END
  FROM public.user_roles WHERE user_id = auth.uid();
$$;

-- =====================================================================
-- 2. Modération des offres : draft -> pending_review -> approved|rejected
-- =====================================================================
ALTER TABLE public.job_offers
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Les offres déjà en ligne avant ce correctif sont réputées approuvées —
-- les repasser en attente masquerait d'un coup toutes les offres réelles
-- existantes, une régression bien plus grave que le manque de modération
-- rétroactive sur des offres déjà publiques depuis des semaines.
UPDATE public.job_offers
SET status = 'approved'
WHERE is_active = true AND archived_at IS NULL AND status = 'pending_review';

-- Lecture publique : approved + actif + non archivé, les trois conditions.
DROP POLICY IF EXISTS "Anyone can view active job offers" ON public.job_offers;
CREATE POLICY "Anyone can view active job offers" ON public.job_offers
  FOR SELECT USING (status = 'approved' AND is_active = true AND archived_at IS NULL);

-- Toute modification d'un champ substantiel par le recruteur repasse
-- l'offre en attente — jamais d'approbation automatique qui survivrait à
-- un changement de contenu. is_active/archived_at/status/status_updated_at
-- eux-mêmes ne déclenchent pas ce trigger (sinon la modération ADMIN
-- elle-même repasserait l'offre en pending_review en boucle).
CREATE OR REPLACE FUNCTION public.reset_job_offer_moderation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.current_user_role() = 'admin' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Seul un administrateur peut changer le statut de modération.';
  END IF;

  IF (NEW.title, NEW.description, NEW.location, NEW.company, NEW.contract_type,
      NEW.salary_range, NEW.min_education_level, NEW.deadline, NEW.image_url)
     IS DISTINCT FROM
     (OLD.title, OLD.description, OLD.location, OLD.company, OLD.contract_type,
      OLD.salary_range, OLD.min_education_level, OLD.deadline, OLD.image_url)
  THEN
    NEW.status := 'pending_review';
    NEW.status_updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_job_offer_moderation ON public.job_offers;
CREATE TRIGGER trg_reset_job_offer_moderation
  BEFORE UPDATE ON public.job_offers
  FOR EACH ROW EXECUTE FUNCTION public.reset_job_offer_moderation();

-- Nouvelle offre : jamais approuvée à la création, y compris si le
-- recruiter_id correspond à un admin qui teste son propre compte.
ALTER TABLE public.job_offers ALTER COLUMN status SET DEFAULT 'pending_review';

-- Fonction de décision — admin uniquement (l'espace admin dépend de
-- role='admin' seul, jamais d'un badge, cf. règle générale du chantier).
CREATE OR REPLACE FUNCTION public.moderate_job_offer(offer_id UUID, decision TEXT, reason TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_recruiter UUID;
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;
  IF decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Décision invalide.';
  END IF;

  SELECT recruiter_id INTO target_recruiter FROM public.job_offers WHERE id = offer_id;
  IF target_recruiter IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.job_offers
  SET status = decision, status_updated_at = now()
  WHERE id = offer_id;

  PERFORM public.log_security_event(
    'job_offer_moderated', 'info', auth.uid(), target_recruiter,
    jsonb_build_object('offer_id', offer_id, 'decision', decision, 'reason', reason)
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.moderate_job_offer(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderate_job_offer(UUID, TEXT, TEXT) TO authenticated;

-- Un recruteur voit toujours ses propres offres quel que soit leur statut
-- (déjà en place depuis la Vague 2 — "Un recruteur lit ses propres
-- offres" — non touché ici, juste documenté pour clarté).

-- =====================================================================
-- 3. Signalements — table minimale, append-only côté déclarant.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('job_offer')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reports FROM authenticated, anon;

CREATE POLICY "Un utilisateur signale (INSERT)" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);
GRANT INSERT (target_type, target_id, reason) ON public.reports TO authenticated;
-- reporter_id doit être fourni par le client pour matcher le WITH CHECK
-- ci-dessus (auth.uid() = reporter_id) : PostgREST exige la colonne dans le
-- payload d'INSERT même si la valeur doit être auth.uid() lui-même.
GRANT INSERT (reporter_id) ON public.reports TO authenticated;

CREATE POLICY "Un utilisateur lit ses propres signalements" ON public.reports
  FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "Un admin lit tous les signalements" ON public.reports
  FOR SELECT USING (public.current_user_role() = 'admin');
GRANT SELECT ON public.reports TO authenticated;

-- Résolution : admin uniquement, colonnes de résolution seulement (jamais
-- reporter_id/target_id/reason — même discipline que security_logs).
CREATE POLICY "Un admin resout un signalement" ON public.reports
  FOR UPDATE USING (public.current_user_role() = 'admin');
GRANT UPDATE (status, resolved_by, resolved_at) ON public.reports TO authenticated;

-- =====================================================================
-- 4. Suspension : session révoquée immédiatement au moment du changement
-- de statut, pas seulement au prochain accès. Voir
-- api/admin/users/[id]/status/route.js pour l'appel à auth.admin.signOut()
-- côté serveur — rien à faire ici en SQL, juste documenté pour traçabilité.
-- =====================================================================
