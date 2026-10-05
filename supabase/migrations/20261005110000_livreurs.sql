-- Accréditation livreur (Point 4/12 du chantier « livraison Marketplace »).
--
-- Volontairement SANS toucher à public.user_roles ni src/proxy.js : ajouter
-- une 4e valeur de rôle ('livreur') toucherait le middleware, les policies
-- RLS existantes et l'invariant 11, pour un bénéfice faible. À la place, on
-- reprend le patron badge_requests (demande self-service + pièces
-- justificatives + validation par un modérateur) sur deux tables dédiées,
-- séparées du RBAC : l'appartenance « livreur actif » se vérifie par un
-- EXISTS sur public.livreurs, jamais par user_roles.role.

-- ---------------------------------------------------------------------------
-- Demandes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.livreurs_demandes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nom_complet       TEXT NOT NULL CHECK (btrim(nom_complet) <> ''),
  telephone         TEXT NOT NULL CHECK (btrim(telephone) <> ''),
  ville_zone        TEXT NOT NULL CHECK (btrim(ville_zone) <> ''),
  type_vehicule     TEXT NOT NULL CHECK (type_vehicule IN ('pied', 'velo', 'moto', 'voiture')),
  document_urls     TEXT[] NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason  TEXT,
  reviewed_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Anti-spam par contrainte, même mécanisme que badge_requests : une seule
-- demande pending à la fois par personne.
CREATE UNIQUE INDEX IF NOT EXISTS idx_livreurs_demandes_one_pending
  ON public.livreurs_demandes (user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_livreurs_demandes_status ON public.livreurs_demandes(status);

ALTER TABLE public.livreurs_demandes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Depot de sa propre demande de livreur" ON public.livreurs_demandes;
CREATE POLICY "Depot de sa propre demande de livreur" ON public.livreurs_demandes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Lecture de sa propre demande ou par un moderateur" ON public.livreurs_demandes;
CREATE POLICY "Lecture de sa propre demande ou par un moderateur" ON public.livreurs_demandes
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.current_user_role() IN ('admin', 'publisher')
  );

DROP POLICY IF EXISTS "Un moderateur traite les demandes de livreur" ON public.livreurs_demandes;
CREATE POLICY "Un moderateur traite les demandes de livreur" ON public.livreurs_demandes
  FOR UPDATE USING (public.current_user_role() IN ('admin', 'publisher'));

-- user_id immuable après création, même raisonnement que
-- prevent_badge_request_tampering.
CREATE OR REPLACE FUNCTION public.prevent_livreur_request_tampering()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'user_id est immuable après création.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_prevent_livreur_request_tampering ON public.livreurs_demandes;
CREATE TRIGGER trg_prevent_livreur_request_tampering
  BEFORE UPDATE ON public.livreurs_demandes
  FOR EACH ROW EXECUTE FUNCTION public.prevent_livreur_request_tampering();

-- ---------------------------------------------------------------------------
-- Livreurs accrédités
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.livreurs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  statut            TEXT NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'suspendu')),
  type_vehicule     TEXT,
  telephone         TEXT,
  zone_principale   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  suspendu_le       TIMESTAMPTZ,
  suspendu_par      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  motif_suspension  TEXT
);

ALTER TABLE public.livreurs ENABLE ROW LEVEL SECURITY;

-- Un acheteur doit pouvoir voir qui lui est assigné (nom/téléphone) sur sa
-- propre commande ; un vendeur n'a besoin de rien de plus que ce que
-- marketplace_commandes expose déjà.
DROP POLICY IF EXISTS "Lecture de son propre profil livreur" ON public.livreurs;
CREATE POLICY "Lecture de son propre profil livreur" ON public.livreurs
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.current_user_role() IN ('admin', 'publisher')
    OR EXISTS (
      SELECT 1 FROM public.marketplace_commandes c
      WHERE c.livreur_id = livreurs.user_id AND c.acheteur_id = auth.uid()
    )
  );

-- Aucune policy d'écriture : toute transition passe par les fonctions
-- SECURITY DEFINER ci-dessous (invariant 1).
GRANT SELECT ON public.livreurs_demandes TO authenticated;
GRANT SELECT ON public.livreurs TO authenticated;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'jobs', 'posts', 'mentions', 'candidature', 'reponse',
    'badge', 'message', 'system', 'document_access', 'document_delivery',
    'support_escalade', 'marketplace_signalement', 'marketplace_commande',
    'livreur_statut'
  ]));

-- ---------------------------------------------------------------------------
-- Bucket privé des pièces justificatives livreur
-- ---------------------------------------------------------------------------
-- Distinct de badge-documents : des pièces d'identité différentes, jamais
-- mutualisées entre deux types de justificatifs (convention du dépôt).
INSERT INTO storage.buckets (id, name, public)
VALUES ('livreur-documents', 'livreur-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Upload de ses propres documents de livreur" ON storage.objects;
CREATE POLICY "Upload de ses propres documents de livreur" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'livreur-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Lecture de ses propres documents de livreur" ON storage.objects;
CREATE POLICY "Lecture de ses propres documents de livreur" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'livreur-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Un moderateur lit les documents de livreur" ON storage.objects;
CREATE POLICY "Un moderateur lit les documents de livreur" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'livreur-documents' AND public.current_user_role() IN ('admin', 'publisher'));

-- Pas de policy DELETE authenticated : purge uniquement via le job planifié
-- (service_role), comme pour badge-documents.

-- ---------------------------------------------------------------------------
-- Déposer sa demande
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.demander_devenir_livreur(
  p_nom_complet   TEXT,
  p_telephone     TEXT,
  p_ville_zone    TEXT,
  p_type_vehicule TEXT,
  p_document_urls TEXT[] DEFAULT '{}'
)
RETURNS public.livreurs_demandes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_row public.livreurs_demandes;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.livreurs WHERE user_id = v_moi AND statut = 'actif') THEN
    RAISE EXCEPTION 'Vous êtes déjà livreur actif.';
  END IF;

  INSERT INTO public.livreurs_demandes
    (user_id, nom_complet, telephone, ville_zone, type_vehicule, document_urls)
  VALUES (
    v_moi, btrim(p_nom_complet), btrim(p_telephone), btrim(p_ville_zone),
    p_type_vehicule, coalesce(p_document_urls, '{}')
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.demander_devenir_livreur(TEXT, TEXT, TEXT, TEXT, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.demander_devenir_livreur(TEXT, TEXT, TEXT, TEXT, TEXT[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- approve_livreur_request / reject_livreur_request / suspend_livreur
-- ---------------------------------------------------------------------------
-- Noms en anglais (comme approve_badge_request/reject_badge_request/
-- revoke_badge) : l'invariant 13 détecte automatiquement les fonctions
-- critiques de modération sans GRANT EXECUTE via ces motifs.
CREATE OR REPLACE FUNCTION public.approve_livreur_request(request_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_user_id UUID;
  v_type_vehicule TEXT;
  v_telephone TEXT;
  v_ville_zone TEXT;
BEGIN
  IF public.current_user_role() NOT IN ('admin', 'publisher') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs et modérateurs.';
  END IF;

  UPDATE public.livreurs_demandes
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = request_id AND status = 'pending'
  RETURNING user_id, type_vehicule, telephone, ville_zone
  INTO target_user_id, v_type_vehicule, v_telephone, v_ville_zone;

  IF target_user_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.livreurs (user_id, statut, type_vehicule, telephone, zone_principale)
  VALUES (target_user_id, 'actif', v_type_vehicule, v_telephone, v_ville_zone)
  ON CONFLICT (user_id) DO UPDATE SET
    statut = 'actif',
    type_vehicule = excluded.type_vehicule,
    telephone = excluded.telephone,
    zone_principale = excluded.zone_principale,
    suspendu_le = NULL,
    suspendu_par = NULL,
    motif_suspension = NULL;

  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  VALUES (target_user_id, auth.uid(), 'livreur_statut', 'Votre demande pour devenir livreur a été approuvée !', '/marketplace?onglet=livrer');

  PERFORM public.log_security_event(
    'livreur_approved', 'info', auth.uid(), target_user_id,
    jsonb_build_object('request_id', request_id)
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_livreur_request(request_id UUID, reason TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  IF public.current_user_role() NOT IN ('admin', 'publisher') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs et modérateurs.';
  END IF;

  UPDATE public.livreurs_demandes
  SET status = 'rejected', rejection_reason = reason, reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = request_id AND status = 'pending'
  RETURNING user_id INTO target_user_id;

  IF target_user_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  VALUES (target_user_id, auth.uid(), 'livreur_statut', 'Votre demande pour devenir livreur a été refusée.', '/marketplace?onglet=livrer');

  PERFORM public.log_security_event(
    'livreur_rejected', 'info', auth.uid(), target_user_id,
    jsonb_build_object('request_id', request_id, 'reason', reason)
  );

  RETURN true;
END;
$$;

-- Admin uniquement (pas publisher) : plus sensible qu'une approbation, même
-- raisonnement que revoke_badge.
CREATE OR REPLACE FUNCTION public.suspend_livreur(target_user_id UUID, reason TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;

  UPDATE public.livreurs
  SET statut = 'suspendu', suspendu_le = now(), suspendu_par = auth.uid(), motif_suspension = reason
  WHERE user_id = target_user_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  VALUES (target_user_id, auth.uid(), 'livreur_statut', 'Votre compte livreur a été suspendu.', '/marketplace?onglet=livrer');

  PERFORM public.log_security_event(
    'livreur_suspended', 'warning', auth.uid(), target_user_id,
    jsonb_build_object('reason', reason)
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_livreur_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_livreur_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suspend_livreur(UUID, TEXT) TO authenticated;
