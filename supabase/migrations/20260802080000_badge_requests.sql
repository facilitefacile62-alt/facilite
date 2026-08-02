-- Section 4 du chantier RBAC : demandes d'accréditation.

CREATE TABLE IF NOT EXISTS public.badge_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_badge TEXT NOT NULL CHECK (requested_badge IN ('verified_recruiter', 'official_staff')),
  company_name TEXT,
  ninea_number TEXT,
  rccm_number TEXT,
  document_urls TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Un recruteur qui demande verified_recruiter sans NINEA/RCCM n'est pas
  -- une simple négligence de formulaire à valider côté client : c'est
  -- l'exigence métier explicite ("les recruteurs doivent obligatoirement
  -- fournir..."), imposée ici pour qu'aucun appel direct à l'API (clé anon)
  -- ne puisse la contourner.
  CONSTRAINT verified_recruiter_requires_company_docs CHECK (
    requested_badge <> 'verified_recruiter'
    OR (ninea_number IS NOT NULL AND rccm_number IS NOT NULL AND company_name IS NOT NULL)
  )
);

-- Anti-spam par contrainte, pas par vérification applicative (demandé
-- explicitement) : un index unique partiel empêche toute seconde ligne
-- pending pour le même (user_id, requested_badge) au niveau base — un
-- INSERT concurrent échoue avec une violation de contrainte, pas une race
-- condition read-then-check côté serveur.
CREATE UNIQUE INDEX IF NOT EXISTS idx_badge_requests_one_pending_per_badge
  ON public.badge_requests (user_id, requested_badge)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_badge_requests_status ON public.badge_requests(status);

ALTER TABLE public.badge_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Depot de sa propre demande de badge" ON public.badge_requests;
CREATE POLICY "Depot de sa propre demande de badge" ON public.badge_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- SELECT : sa propre demande, ou admin/publisher (le publisher doit voir
-- les demandes en attente pour les traiter, section 5).
DROP POLICY IF EXISTS "Lecture de sa propre demande ou par un moderateur" ON public.badge_requests;
CREATE POLICY "Lecture de sa propre demande ou par un moderateur" ON public.badge_requests
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.current_user_role() IN ('admin', 'publisher')
  );

-- UPDATE : admin/publisher uniquement (le déposant ne peut jamais modifier
-- sa propre demande après coup, y compris son propre statut).
DROP POLICY IF EXISTS "Un moderateur traite les demandes de badge" ON public.badge_requests;
CREATE POLICY "Un moderateur traite les demandes de badge" ON public.badge_requests
  FOR UPDATE USING (public.current_user_role() IN ('admin', 'publisher'));

-- user_id et requested_badge immuables après création (trigger, comme
-- demandé) : même si un modérateur malveillant obtenait un accès UPDATE
-- détourné, il ne pourrait pas réassigner une demande à quelqu'un d'autre
-- ni changer le badge demandé après coup pour approuver autre chose que ce
-- qui a été réellement soumis/documenté.
CREATE OR REPLACE FUNCTION public.prevent_badge_request_tampering()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.requested_badge IS DISTINCT FROM OLD.requested_badge THEN
    RAISE EXCEPTION 'user_id et requested_badge sont immuables après création.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_prevent_badge_request_tampering ON public.badge_requests;
CREATE TRIGGER trg_prevent_badge_request_tampering
  BEFORE UPDATE ON public.badge_requests
  FOR EACH ROW EXECUTE FUNCTION public.prevent_badge_request_tampering();

-- =====================================================================
-- has_badge(user_id, badge_name) — lecture publique du tableau cosmétique
-- =====================================================================
-- SECURITY DEFINER : profiles.badges reste lisible normalement (colonne
-- publique, pas besoin de contourner une restriction de lecture) — cette
-- fonction existe pour donner un point d'accès stable et testable plutôt
-- que de répéter "badges @> '[...]'" partout dans les policies/vues qui en
-- auront besoin (candidats_recherche, match_resumes, section 7).
CREATE OR REPLACE FUNCTION public.has_badge(check_user_id UUID, badge_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT badges @> to_jsonb(ARRAY[badge_name]) FROM public.profiles WHERE id = check_user_id),
    false
  );
$$;

-- =====================================================================
-- approve_badge_request(request_id) / reject_badge_request(request_id, reason)
-- =====================================================================
-- GRANT EXECUTE à authenticated (contrairement à deduct_credit/
-- log_security_event) : ces deux fonctions sont conçues pour être
-- appelées directement par un admin/publisher via son propre client
-- (comme demandé — "accessible uniquement aux rôles admin et publisher"),
-- pas uniquement depuis une route serveur. L'autorisation est donc
-- entièrement vérifiée À L'INTÉRIEUR de la fonction (current_user_role()),
-- jamais supposée côté appelant.
CREATE OR REPLACE FUNCTION public.approve_badge_request(request_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_user_id UUID;
  target_badge TEXT;
  caller_role TEXT;
BEGIN
  caller_role := public.current_user_role();
  IF caller_role NOT IN ('admin', 'publisher') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs et modérateurs.';
  END IF;

  UPDATE public.badge_requests
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = request_id AND status = 'pending'
  RETURNING user_id, requested_badge INTO target_user_id, target_badge;

  IF target_user_id IS NULL THEN
    -- Introuvable, ou déjà traitée (pending -> approved/rejected est une
    -- transition à sens unique) : même garde-fou d'idempotence que le
    -- webhook KPay (payment_status pending -> paid).
    RETURN false;
  END IF;

  -- badges || élément unique : @> vérifié avant pour ne jamais dupliquer
  -- une entrée si approve_badge_request est rappelée par erreur sur une
  -- ligne déjà traitée par une autre voie.
  UPDATE public.profiles
  SET badges = CASE
    WHEN badges @> to_jsonb(ARRAY[target_badge]) THEN badges
    ELSE badges || to_jsonb(ARRAY[target_badge])
  END
  WHERE id = target_user_id;

  PERFORM public.log_security_event(
    'badge_approved',
    'info',
    auth.uid(),
    target_user_id,
    jsonb_build_object('badge', target_badge, 'request_id', request_id)
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_badge_request(request_id UUID, reason TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_user_id UUID;
  target_badge TEXT;
  caller_role TEXT;
BEGIN
  caller_role := public.current_user_role();
  IF caller_role NOT IN ('admin', 'publisher') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs et modérateurs.';
  END IF;

  UPDATE public.badge_requests
  SET status = 'rejected', rejection_reason = reason, reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = request_id AND status = 'pending'
  RETURNING user_id, requested_badge INTO target_user_id, target_badge;

  IF target_user_id IS NULL THEN
    RETURN false;
  END IF;

  PERFORM public.log_security_event(
    'badge_rejected',
    'info',
    auth.uid(),
    target_user_id,
    jsonb_build_object('badge', target_badge, 'request_id', request_id, 'reason', reason)
  );

  RETURN true;
END;
$$;

-- revoke_badge : admin uniquement (pas publisher — plus sensible qu'une
-- approbation, cf. section 5 "bloque strictement... gestion globale des
-- utilisateurs" pour publisher). Ne dépend pas d'une ligne badge_requests
-- existante : un admin doit pouvoir retirer un badge même si la demande
-- d'origine a été nettoyée par le job de purge (section 4, 30 jours).
CREATE OR REPLACE FUNCTION public.revoke_badge(target_user_id UUID, badge_name TEXT, reason TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;

  UPDATE public.profiles
  SET badges = badges - badge_name
  WHERE id = target_user_id;

  PERFORM public.log_security_event(
    'badge_revoked',
    'warning',
    auth.uid(),
    target_user_id,
    jsonb_build_object('badge', badge_name, 'reason', reason)
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_badge_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_badge_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_badge(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_badge(UUID, TEXT) TO authenticated, anon;
