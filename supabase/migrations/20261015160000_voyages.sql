-- Voyages (transport de passagers) — point 1 : chauffeurs validés + voyages groupés.
--
-- Un CHAUFFEUR validé par un administrateur annonce un voyage (départ, destination,
-- heure, places, prix par place) ; des PASSAGERS y réservent des places ; le chauffeur
-- accepte ou refuse chaque réservation avant de partir ; les passagers acceptés suivent
-- le chauffeur en direct sur la carte. Même logique que le groupage de livraison
-- (20261015120000), appliquée à des personnes — donc avec des garde-fous plus stricts.
--
-- CHOIX (validés avec le propriétaire)
--  1. Seuls des chauffeurs VALIDÉS transportent des personnes : demande « Devenir
--     chauffeur » (permis, assurance…), traitée par un administrateur/modérateur,
--     sur le patron de livreurs_demandes / approve_livreur_request. Les documents vont
--     dans un bucket PRIVÉ (chauffeur-documents).
--  2. Prix par place fixé par le chauffeur ; règlement entre eux à la montée. Facilité
--     ne gère aucun argent de ces voyages.
--  3. Voyage groupé d'abord ; la course à la demande viendra plus tard.
--
-- CONFIDENTIALITÉ
--  * La position EN DIRECT du chauffeur n'est PAS dans la table voyages (lisible par
--    tous les connectés) mais dans voyages_positions, lisible seulement par le chauffeur
--    et les passagers ACCEPTÉS de ce voyage, et supprimée quand le voyage se termine.
--  * Nom et téléphone du passager ne sont révélés au chauffeur qu'après acceptation ;
--    nom, téléphone, véhicule et plaque du chauffeur ne sont révélés au passager
--    qu'une fois sa réservation acceptée.
--  * Aucune écriture directe : les tables n'accordent que SELECT (invariant 1) ; tout
--    passe par des fonctions SECURITY DEFINER qui revérifient l'identité en interne.

-- ---------------------------------------------------------------------------
-- Demandes et comptes chauffeur
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chauffeurs_demandes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nom_complet       TEXT NOT NULL CHECK (char_length(btrim(nom_complet)) BETWEEN 2 AND 80),
  telephone         TEXT NOT NULL CHECK (char_length(btrim(telephone)) BETWEEN 6 AND 20),
  ville_zone        TEXT NOT NULL CHECK (char_length(btrim(ville_zone)) BETWEEN 1 AND 80),
  type_vehicule     TEXT NOT NULL CHECK (type_vehicule IN ('moto', 'voiture', 'minibus')),
  marque_modele     TEXT NOT NULL CHECK (char_length(btrim(marque_modele)) BETWEEN 2 AND 60),
  immatriculation   TEXT NOT NULL CHECK (char_length(btrim(immatriculation)) BETWEEN 3 AND 20),
  places_passagers  INTEGER NOT NULL CHECK (places_passagers BETWEEN 1 AND 14),
  document_urls     TEXT[] NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason  TEXT,
  reviewed_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Une seule demande en attente à la fois par utilisateur (anti-spam).
CREATE UNIQUE INDEX IF NOT EXISTS idx_chauffeurs_demandes_one_pending
  ON public.chauffeurs_demandes (user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_chauffeurs_demandes_status ON public.chauffeurs_demandes(status);

ALTER TABLE public.chauffeurs_demandes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture de sa demande de chauffeur ou par un moderateur" ON public.chauffeurs_demandes;
CREATE POLICY "Lecture de sa demande de chauffeur ou par un moderateur" ON public.chauffeurs_demandes
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.current_user_role() IN ('admin', 'publisher')
  );

CREATE OR REPLACE FUNCTION public.prevent_chauffeur_request_tampering()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'user_id est immuable après création.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_prevent_chauffeur_request_tampering ON public.chauffeurs_demandes;
CREATE TRIGGER trg_prevent_chauffeur_request_tampering
  BEFORE UPDATE ON public.chauffeurs_demandes
  FOR EACH ROW EXECUTE FUNCTION public.prevent_chauffeur_request_tampering();

CREATE TABLE IF NOT EXISTS public.chauffeurs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  statut            TEXT NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'suspendu')),
  type_vehicule     TEXT,
  marque_modele     TEXT,
  immatriculation   TEXT,
  places_passagers  INTEGER CHECK (places_passagers IS NULL OR places_passagers BETWEEN 1 AND 14),
  telephone         TEXT,
  zone_principale   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  suspendu_le       TIMESTAMPTZ,
  suspendu_par      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  motif_suspension  TEXT
);

ALTER TABLE public.chauffeurs ENABLE ROW LEVEL SECURITY;

-- On lit son propre profil ; un modérateur lit tout. Un passager n'a PAS de lecture directe :
-- il passe par infos_chauffeur_de_ma_reservation, qui ne répond qu'après acceptation.
DROP POLICY IF EXISTS "Lecture de son propre profil chauffeur" ON public.chauffeurs;
CREATE POLICY "Lecture de son propre profil chauffeur" ON public.chauffeurs
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.current_user_role() IN ('admin', 'publisher')
  );

REVOKE ALL ON public.chauffeurs_demandes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.chauffeurs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.chauffeurs_demandes TO authenticated;
GRANT SELECT ON public.chauffeurs TO authenticated;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'jobs', 'posts', 'mentions', 'candidature', 'reponse',
    'badge', 'message', 'system', 'document_access', 'document_delivery',
    'support_escalade', 'marketplace_signalement', 'marketplace_commande',
    'livreur_statut', 'chauffeur_statut', 'voyage'
  ]));

-- Documents (permis, assurance, carte grise) : bucket PRIVÉ, un dossier par utilisateur.
INSERT INTO storage.buckets (id, name, public)
VALUES ('chauffeur-documents', 'chauffeur-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Upload de ses propres documents de chauffeur" ON storage.objects;
CREATE POLICY "Upload de ses propres documents de chauffeur" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chauffeur-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Lecture de ses propres documents de chauffeur" ON storage.objects;
CREATE POLICY "Lecture de ses propres documents de chauffeur" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chauffeur-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Un moderateur lit les documents de chauffeur" ON storage.objects;
CREATE POLICY "Un moderateur lit les documents de chauffeur" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chauffeur-documents' AND public.current_user_role() IN ('admin', 'publisher'));

CREATE OR REPLACE FUNCTION public.demander_devenir_chauffeur(
  p_nom_complet      TEXT,
  p_telephone        TEXT,
  p_ville_zone       TEXT,
  p_type_vehicule    TEXT,
  p_marque_modele    TEXT,
  p_immatriculation  TEXT,
  p_places_passagers INTEGER,
  p_document_urls    TEXT[] DEFAULT '{}'
)
RETURNS public.chauffeurs_demandes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_row public.chauffeurs_demandes;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.chauffeurs WHERE user_id = v_moi AND statut = 'actif') THEN
    RAISE EXCEPTION 'Vous êtes déjà chauffeur actif.';
  END IF;
  -- Transporter des personnes : au moins deux justificatifs (par exemple permis et assurance).
  IF coalesce(array_length(p_document_urls, 1), 0) < 2 THEN
    RAISE EXCEPTION 'Joignez au moins deux justificatifs (permis de conduire et assurance).';
  END IF;
  IF p_type_vehicule = 'moto' AND coalesce(p_places_passagers, 0) > 1 THEN
    RAISE EXCEPTION 'Une moto transporte un seul passager.';
  END IF;

  INSERT INTO public.chauffeurs_demandes
    (user_id, nom_complet, telephone, ville_zone, type_vehicule, marque_modele, immatriculation, places_passagers, document_urls)
  VALUES (
    v_moi, btrim(p_nom_complet), btrim(p_telephone), btrim(p_ville_zone), p_type_vehicule,
    btrim(p_marque_modele), upper(btrim(p_immatriculation)), p_places_passagers, p_document_urls
  )
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.demander_devenir_chauffeur(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.demander_devenir_chauffeur(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT[]) TO authenticated;

-- Noms de modération en ANGLAIS (approve_/reject_/suspend_) : l'invariant 13 détecte
-- ainsi automatiquement les fonctions critiques sans GRANT EXECUTE.
CREATE OR REPLACE FUNCTION public.approve_chauffeur_request(request_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  d public.chauffeurs_demandes;
BEGIN
  IF public.current_user_role() NOT IN ('admin', 'publisher') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs et modérateurs.';
  END IF;

  UPDATE public.chauffeurs_demandes
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = request_id AND status = 'pending'
  RETURNING * INTO d;
  IF d.id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.chauffeurs (user_id, statut, type_vehicule, marque_modele, immatriculation, places_passagers, telephone, zone_principale)
  VALUES (d.user_id, 'actif', d.type_vehicule, d.marque_modele, d.immatriculation, d.places_passagers, d.telephone, d.ville_zone)
  ON CONFLICT (user_id) DO UPDATE SET
    statut = 'actif',
    type_vehicule = excluded.type_vehicule,
    marque_modele = excluded.marque_modele,
    immatriculation = excluded.immatriculation,
    places_passagers = excluded.places_passagers,
    telephone = excluded.telephone,
    zone_principale = excluded.zone_principale,
    suspendu_le = NULL,
    suspendu_par = NULL,
    motif_suspension = NULL;

  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  VALUES (d.user_id, auth.uid(), 'chauffeur_statut', 'Votre demande pour devenir chauffeur a été approuvée !', '/marketplace?onglet=livrer');

  PERFORM public.log_security_event('chauffeur_approved', 'info', auth.uid(), d.user_id, jsonb_build_object('request_id', request_id));
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_chauffeur_request(request_id UUID, reason TEXT)
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

  UPDATE public.chauffeurs_demandes
  SET status = 'rejected', rejection_reason = reason, reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = request_id AND status = 'pending'
  RETURNING user_id INTO target_user_id;
  IF target_user_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  VALUES (target_user_id, auth.uid(), 'chauffeur_statut', 'Votre demande pour devenir chauffeur a été refusée.', '/marketplace?onglet=livrer');

  PERFORM public.log_security_event('chauffeur_rejected', 'info', auth.uid(), target_user_id, jsonb_build_object('request_id', request_id, 'reason', reason));
  RETURN true;
END;
$$;

-- Suspension : réservée aux administrateurs. Les voyages ouverts du chauffeur sont annulés
-- (leurs passagers prévenus) : un chauffeur suspendu ne doit pas rester en circulation.
CREATE OR REPLACE FUNCTION public.suspend_chauffeur(target_user_id UUID, reason TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;

  UPDATE public.chauffeurs
  SET statut = 'suspendu', suspendu_le = now(), suspendu_par = auth.uid(), motif_suspension = reason
  WHERE user_id = target_user_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  SELECT r.passager_id, auth.uid(), 'voyage', 'Votre voyage a été annulé : le chauffeur n''est plus disponible.', '/marketplace'
  FROM public.voyages_reservations r
  JOIN public.voyages v ON v.id = r.voyage_id
  WHERE v.chauffeur_id = target_user_id AND v.statut = 'ouvert' AND r.statut IN ('en_attente', 'acceptee');

  UPDATE public.voyages_reservations r SET statut = 'annulee', updated_at = now()
  FROM public.voyages v
  WHERE v.id = r.voyage_id AND v.chauffeur_id = target_user_id AND v.statut = 'ouvert' AND r.statut IN ('en_attente', 'acceptee');
  UPDATE public.voyages SET statut = 'annule', updated_at = now() WHERE chauffeur_id = target_user_id AND statut = 'ouvert';

  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  VALUES (target_user_id, auth.uid(), 'chauffeur_statut', 'Votre compte chauffeur a été suspendu.', '/marketplace?onglet=livrer');

  PERFORM public.log_security_event('chauffeur_suspended', 'warning', auth.uid(), target_user_id, jsonb_build_object('reason', reason));
  RETURN true;
END;
$$;

-- ---------------------------------------------------------------------------
-- Voyages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.voyages (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chauffeur_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  depart_libelle         TEXT NOT NULL CHECK (char_length(btrim(depart_libelle)) BETWEEN 1 AND 80),
  depart_lat             DOUBLE PRECISION NOT NULL CHECK (depart_lat BETWEEN -90 AND 90),
  depart_lng             DOUBLE PRECISION NOT NULL CHECK (depart_lng BETWEEN -180 AND 180),
  destination_libelle    TEXT NOT NULL CHECK (char_length(btrim(destination_libelle)) BETWEEN 1 AND 80),
  destination_lat        DOUBLE PRECISION NOT NULL CHECK (destination_lat BETWEEN -90 AND 90),
  destination_lng        DOUBLE PRECISION NOT NULL CHECK (destination_lng BETWEEN -180 AND 180),
  heure_depart           TIMESTAMPTZ NOT NULL,
  places_max             INTEGER NOT NULL CHECK (places_max BETWEEN 1 AND 14),
  prix_par_place_xof     INTEGER NOT NULL DEFAULT 0 CHECK (prix_par_place_xof BETWEEN 0 AND 200000),
  rayon_prise_km         NUMERIC NOT NULL DEFAULT 3 CHECK (rayon_prise_km BETWEEN 0.5 AND 15),
  rayon_destination_km   NUMERIC NOT NULL DEFAULT 5 CHECK (rayon_destination_km BETWEEN 1 AND 30),
  note                   TEXT CHECK (note IS NULL OR char_length(note) <= 200),
  statut                 TEXT NOT NULL DEFAULT 'ouvert' CHECK (statut IN ('ouvert', 'en_route', 'termine', 'annule')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voyages_chauffeur ON public.voyages(chauffeur_id);
CREATE INDEX IF NOT EXISTS idx_voyages_ouverts ON public.voyages(heure_depart) WHERE statut = 'ouvert';

ALTER TABLE public.voyages ENABLE ROW LEVEL SECURITY;

-- Les voyages annoncés ou en cours sont visibles de tout utilisateur connecté (les passagers
-- doivent les trouver). La position en direct n'est PAS dans cette table.
DROP POLICY IF EXISTS "voyages ouverts visibles aux connectes" ON public.voyages;
CREATE POLICY "voyages ouverts visibles aux connectes" ON public.voyages
  FOR SELECT TO authenticated
  USING (
    statut IN ('ouvert', 'en_route')
    OR chauffeur_id = auth.uid()
    OR public.is_admin(auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.voyages_reservations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voyage_id      UUID NOT NULL REFERENCES public.voyages(id) ON DELETE CASCADE,
  passager_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  places         INTEGER NOT NULL CHECK (places BETWEEN 1 AND 4),
  prise_libelle  TEXT NOT NULL CHECK (char_length(btrim(prise_libelle)) BETWEEN 1 AND 80),
  prise_lat      DOUBLE PRECISION NOT NULL CHECK (prise_lat BETWEEN -90 AND 90),
  prise_lng      DOUBLE PRECISION NOT NULL CHECK (prise_lng BETWEEN -180 AND 180),
  statut         TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'acceptee', 'refusee', 'annulee')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Une seule réservation active par passager et par voyage.
CREATE UNIQUE INDEX IF NOT EXISTS idx_voyages_reservations_une_active
  ON public.voyages_reservations (voyage_id, passager_id) WHERE statut IN ('en_attente', 'acceptee');
CREATE INDEX IF NOT EXISTS idx_voyages_reservations_passager ON public.voyages_reservations(passager_id);

ALTER TABLE public.voyages_reservations ENABLE ROW LEVEL SECURITY;

-- Le passager lit les siennes ; le chauffeur lit celles de ses voyages (sans nom ni téléphone :
-- ceux-ci ne sortent que par lister_reservations_de_mon_voyage, après acceptation).
DROP POLICY IF EXISTS "parties lisent les reservations de voyage" ON public.voyages_reservations;
CREATE POLICY "parties lisent les reservations de voyage" ON public.voyages_reservations
  FOR SELECT TO authenticated
  USING (
    passager_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.voyages v WHERE v.id = voyages_reservations.voyage_id AND v.chauffeur_id = auth.uid())
    OR public.is_admin(auth.uid())
  );

-- Position en direct du chauffeur : une ligne par voyage, réécrite à chaque mise à jour.
CREATE TABLE IF NOT EXISTS public.voyages_positions (
  voyage_id  UUID PRIMARY KEY REFERENCES public.voyages(id) ON DELETE CASCADE,
  lat        DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng        DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  maj_le     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.voyages_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chauffeur et passagers acceptes lisent la position" ON public.voyages_positions;
CREATE POLICY "chauffeur et passagers acceptes lisent la position" ON public.voyages_positions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.voyages v WHERE v.id = voyages_positions.voyage_id AND v.chauffeur_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.voyages_reservations r
      WHERE r.voyage_id = voyages_positions.voyage_id AND r.passager_id = auth.uid() AND r.statut = 'acceptee'
    )
    OR public.is_admin(auth.uid())
  );

REVOKE ALL ON public.voyages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.voyages_reservations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.voyages_positions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.voyages TO authenticated;
GRANT SELECT ON public.voyages_reservations TO authenticated;
GRANT SELECT ON public.voyages_positions TO authenticated;

-- Pour que le suivi en direct arrive chez les passagers (la RLS ci-dessus filtre QUI reçoit).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'voyages_positions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.voyages_positions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'voyages_reservations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.voyages_reservations;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Annoncer un voyage (chauffeur validé)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publier_voyage(
  p_depart_libelle        TEXT,
  p_depart_lat            DOUBLE PRECISION,
  p_depart_lng            DOUBLE PRECISION,
  p_destination_libelle   TEXT,
  p_destination_lat       DOUBLE PRECISION,
  p_destination_lng       DOUBLE PRECISION,
  p_heure_depart          TIMESTAMPTZ,
  p_places_max            INTEGER,
  p_prix_par_place_xof    INTEGER,
  p_rayon_prise_km        NUMERIC DEFAULT 3,
  p_rayon_destination_km  NUMERIC DEFAULT 5,
  p_note                  TEXT DEFAULT NULL
)
RETURNS public.voyages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi    UUID := auth.uid();
  v_places INTEGER;
  v_row    public.voyages;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;
  SELECT c.places_passagers INTO v_places FROM public.chauffeurs c WHERE c.user_id = v_moi AND c.statut = 'actif';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réservé aux chauffeurs validés.';
  END IF;

  IF char_length(btrim(coalesce(p_depart_libelle, ''))) NOT BETWEEN 1 AND 80
     OR char_length(btrim(coalesce(p_destination_libelle, ''))) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Le départ et la destination doivent être nommés (80 caractères maximum).';
  END IF;
  IF p_depart_lat IS NULL OR p_depart_lng IS NULL OR p_destination_lat IS NULL OR p_destination_lng IS NULL
     OR p_depart_lat NOT BETWEEN 12.2 AND 16.8 OR p_destination_lat NOT BETWEEN 12.2 AND 16.8
     OR p_depart_lng NOT BETWEEN -17.9 AND -11.2 OR p_destination_lng NOT BETWEEN -17.9 AND -11.2 THEN
    RAISE EXCEPTION 'Les positions doivent être au Sénégal.';
  END IF;
  IF public.distance_km(p_depart_lat, p_depart_lng, p_destination_lat, p_destination_lng) < 1 THEN
    RAISE EXCEPTION 'Le départ et la destination doivent être distants d''au moins 1 km.';
  END IF;
  IF p_heure_depart IS NULL OR p_heure_depart <= now() OR p_heure_depart > now() + interval '14 days' THEN
    RAISE EXCEPTION 'L''heure de départ doit être dans le futur, dans les 14 prochains jours.';
  END IF;
  IF coalesce(p_places_max, 0) NOT BETWEEN 1 AND coalesce(v_places, 1) THEN
    RAISE EXCEPTION 'Le nombre de places doit être compris entre 1 et % (la capacité de votre véhicule).', coalesce(v_places, 1);
  END IF;
  IF coalesce(p_prix_par_place_xof, -1) NOT BETWEEN 0 AND 200000 THEN
    RAISE EXCEPTION 'Le prix par place doit être compris entre 0 et 200 000 FCFA.';
  END IF;
  IF coalesce(p_rayon_prise_km, 0) NOT BETWEEN 0.5 AND 15 OR coalesce(p_rayon_destination_km, 0) NOT BETWEEN 1 AND 30 THEN
    RAISE EXCEPTION 'Rayons invalides (prise en charge 0,5 à 15 km, destination 1 à 30 km).';
  END IF;
  IF p_note IS NOT NULL AND char_length(p_note) > 200 THEN
    RAISE EXCEPTION 'La note fait 200 caractères au maximum.';
  END IF;
  IF (SELECT count(*) FROM public.voyages WHERE chauffeur_id = v_moi AND statut = 'ouvert') >= 3 THEN
    RAISE EXCEPTION 'Vous avez déjà 3 voyages ouverts : terminez-en ou annulez-en un.';
  END IF;

  INSERT INTO public.voyages (
    chauffeur_id, depart_libelle, depart_lat, depart_lng,
    destination_libelle, destination_lat, destination_lng,
    heure_depart, places_max, prix_par_place_xof,
    rayon_prise_km, rayon_destination_km, note
  )
  VALUES (
    v_moi, btrim(p_depart_libelle), p_depart_lat, p_depart_lng,
    btrim(p_destination_libelle), p_destination_lat, p_destination_lng,
    p_heure_depart, p_places_max, p_prix_par_place_xof,
    p_rayon_prise_km, p_rayon_destination_km, nullif(btrim(coalesce(p_note, '')), '')
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.publier_voyage(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TIMESTAMPTZ, INTEGER, INTEGER, NUMERIC, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publier_voyage(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TIMESTAMPTZ, INTEGER, INTEGER, NUMERIC, NUMERIC, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Chercher un voyage (passager) : d'où je pars, où je vais
-- ---------------------------------------------------------------------------
-- dans_la_zone : ma prise en charge est près du départ ET ma destination près de l'arrivée.
-- Les voyages un peu plus éloignés (jusqu'à p_rayon_km) restent listés pour information.
CREATE OR REPLACE FUNCTION public.rechercher_voyages(
  p_prise_lat DOUBLE PRECISION,
  p_prise_lng DOUBLE PRECISION,
  p_dest_lat  DOUBLE PRECISION,
  p_dest_lng  DOUBLE PRECISION,
  p_rayon_km  DOUBLE PRECISION DEFAULT 25,
  p_limite    INTEGER DEFAULT 30
)
RETURNS TABLE (
  id                      UUID,
  depart_libelle          TEXT,
  depart_lat              DOUBLE PRECISION,
  depart_lng              DOUBLE PRECISION,
  destination_libelle     TEXT,
  destination_lat         DOUBLE PRECISION,
  destination_lng         DOUBLE PRECISION,
  heure_depart            TIMESTAMPTZ,
  places_restantes        INTEGER,
  prix_par_place_xof      INTEGER,
  rayon_prise_km          NUMERIC,
  rayon_destination_km    NUMERIC,
  note                    TEXT,
  chauffeur_prenom        TEXT,
  type_vehicule           TEXT,
  distance_prise_km       DOUBLE PRECISION,
  distance_destination_km DOUBLE PRECISION,
  dans_la_zone            BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;

  RETURN QUERY
  SELECT
    v.id, v.depart_libelle, v.depart_lat, v.depart_lng,
    v.destination_libelle, v.destination_lat, v.destination_lng,
    v.heure_depart,
    greatest(0, v.places_max - (
      SELECT coalesce(sum(r.places), 0)::integer FROM public.voyages_reservations r
      WHERE r.voyage_id = v.id AND r.statut IN ('en_attente', 'acceptee')
    )),
    v.prix_par_place_xof, v.rayon_prise_km, v.rayon_destination_km, v.note,
    nullif(split_part(btrim(coalesce(p.full_name, '')), ' ', 1), ''),
    c.type_vehicule,
    round(public.distance_km(p_prise_lat, p_prise_lng, v.depart_lat, v.depart_lng)::numeric, 2)::double precision,
    round(public.distance_km(p_dest_lat, p_dest_lng, v.destination_lat, v.destination_lng)::numeric, 2)::double precision,
    (public.distance_km(p_prise_lat, p_prise_lng, v.depart_lat, v.depart_lng) <= v.rayon_prise_km::double precision
     AND public.distance_km(p_dest_lat, p_dest_lng, v.destination_lat, v.destination_lng) <= v.rayon_destination_km::double precision)
  FROM public.voyages v
  LEFT JOIN public.chauffeurs c ON c.user_id = v.chauffeur_id
  LEFT JOIN public.profiles p ON p.id = v.chauffeur_id
  WHERE v.statut = 'ouvert'
    AND v.heure_depart > now()
    AND public.distance_km(p_prise_lat, p_prise_lng, v.depart_lat, v.depart_lng) <= greatest(p_rayon_km, v.rayon_prise_km::double precision)
    AND public.distance_km(p_dest_lat, p_dest_lng, v.destination_lat, v.destination_lng) <= greatest(p_rayon_km, v.rayon_destination_km::double precision)
  ORDER BY v.heure_depart ASC
  LIMIT greatest(1, least(coalesce(p_limite, 30), 100));
END;
$$;

REVOKE ALL ON FUNCTION public.rechercher_voyages(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rechercher_voyages(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- Réserver / annuler (passager)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserver_voyage(
  p_voyage_id     UUID,
  p_places        INTEGER,
  p_prise_libelle TEXT,
  p_prise_lat     DOUBLE PRECISION,
  p_prise_lng     DOUBLE PRECISION,
  p_dest_lat      DOUBLE PRECISION,
  p_dest_lng      DOUBLE PRECISION
)
RETURNS public.voyages_reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi  UUID := auth.uid();
  v_v    public.voyages;
  v_prises INTEGER;
  v_row  public.voyages_reservations;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;
  IF coalesce(p_places, 0) NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION 'Vous pouvez réserver de 1 à 4 places.';
  END IF;
  IF char_length(btrim(coalesce(p_prise_libelle, ''))) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Indiquez où le chauffeur doit vous prendre (80 caractères maximum).';
  END IF;
  IF p_prise_lat IS NULL OR p_prise_lng IS NULL OR p_dest_lat IS NULL OR p_dest_lng IS NULL
     OR p_prise_lat NOT BETWEEN 12.2 AND 16.8 OR p_dest_lat NOT BETWEEN 12.2 AND 16.8
     OR p_prise_lng NOT BETWEEN -17.9 AND -11.2 OR p_dest_lng NOT BETWEEN -17.9 AND -11.2 THEN
    RAISE EXCEPTION 'Les positions doivent être au Sénégal.';
  END IF;

  -- Verrou sur le voyage : deux passagers ne peuvent pas prendre la dernière place en même temps.
  SELECT * INTO v_v FROM public.voyages WHERE id = p_voyage_id FOR UPDATE;
  IF v_v.id IS NULL OR v_v.statut IS DISTINCT FROM 'ouvert' OR v_v.heure_depart <= now() THEN
    RAISE EXCEPTION 'Ce voyage n''est plus ouvert.';
  END IF;
  IF v_v.chauffeur_id = v_moi THEN
    RAISE EXCEPTION 'Vous ne pouvez pas réserver votre propre voyage.';
  END IF;
  IF public.distance_km(p_prise_lat, p_prise_lng, v_v.depart_lat, v_v.depart_lng) > v_v.rayon_prise_km::double precision THEN
    RAISE EXCEPTION 'Votre point de prise en charge est trop loin du départ de ce voyage.';
  END IF;
  IF public.distance_km(p_dest_lat, p_dest_lng, v_v.destination_lat, v_v.destination_lng) > v_v.rayon_destination_km::double precision THEN
    RAISE EXCEPTION 'Votre destination est hors de la zone d''arrivée de ce voyage.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.voyages_reservations r WHERE r.voyage_id = v_v.id AND r.passager_id = v_moi AND r.statut IN ('en_attente', 'acceptee')) THEN
    RAISE EXCEPTION 'Vous avez déjà une réservation sur ce voyage.';
  END IF;
  SELECT coalesce(sum(r.places), 0)::integer INTO v_prises
  FROM public.voyages_reservations r WHERE r.voyage_id = v_v.id AND r.statut IN ('en_attente', 'acceptee');
  IF v_prises + p_places > v_v.places_max THEN
    RAISE EXCEPTION 'Il ne reste pas assez de places dans ce voyage.';
  END IF;

  INSERT INTO public.voyages_reservations (voyage_id, passager_id, places, prise_libelle, prise_lat, prise_lng)
  VALUES (v_v.id, v_moi, p_places, btrim(p_prise_libelle), p_prise_lat, p_prise_lng)
  RETURNING * INTO v_row;

  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  VALUES (v_v.chauffeur_id, v_moi, 'voyage', 'Un passager demande ' || p_places || ' place(s) dans votre voyage vers ' || v_v.destination_libelle || '.', '/marketplace?onglet=livrer');

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.reserver_voyage(UUID, INTEGER, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserver_voyage(UUID, INTEGER, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

CREATE OR REPLACE FUNCTION public.annuler_reservation_voyage(p_reservation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_chauffeur UUID;
  v_dest TEXT;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;

  SELECT v.chauffeur_id, v.destination_libelle INTO v_chauffeur, v_dest
  FROM public.voyages_reservations r JOIN public.voyages v ON v.id = r.voyage_id
  WHERE r.id = p_reservation_id AND r.passager_id = v_moi AND r.statut IN ('en_attente', 'acceptee') AND v.statut = 'ouvert';
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE public.voyages_reservations SET statut = 'annulee', updated_at = now()
  WHERE id = p_reservation_id AND passager_id = v_moi;

  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  VALUES (v_chauffeur, v_moi, 'voyage', 'Un passager a annulé sa réservation dans votre voyage vers ' || v_dest || '.', '/marketplace?onglet=livrer');
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.annuler_reservation_voyage(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.annuler_reservation_voyage(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Répondre à une réservation (chauffeur du voyage)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.repondre_reservation_voyage(p_reservation_id UUID, p_accepter BOOLEAN)
RETURNS public.voyages_reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_row public.voyages_reservations;
  v_v   public.voyages;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.chauffeurs WHERE user_id = v_moi AND statut = 'actif') THEN
    RAISE EXCEPTION 'Réservé aux chauffeurs validés.';
  END IF;
  IF p_accepter IS NULL THEN
    RAISE EXCEPTION 'Réponse manquante.';
  END IF;

  SELECT v.* INTO v_v
  FROM public.voyages_reservations r JOIN public.voyages v ON v.id = r.voyage_id
  WHERE r.id = p_reservation_id AND v.chauffeur_id = v_moi AND v.statut = 'ouvert' AND r.statut = 'en_attente'
  FOR UPDATE OF v;
  IF v_v.id IS NULL THEN
    RAISE EXCEPTION 'Cette réservation n''attend plus votre réponse.';
  END IF;

  UPDATE public.voyages_reservations
  SET statut = CASE WHEN p_accepter THEN 'acceptee' ELSE 'refusee' END, updated_at = now()
  WHERE id = p_reservation_id AND statut = 'en_attente'
  RETURNING * INTO v_row;

  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  VALUES (
    v_row.passager_id, v_moi, 'voyage',
    CASE WHEN p_accepter THEN 'Le chauffeur a accepté votre réservation pour ' || v_v.destination_libelle || '.'
         ELSE 'Le chauffeur n''a pas pu vous prendre dans son voyage vers ' || v_v.destination_libelle || '.' END,
    '/marketplace'
  );

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.repondre_reservation_voyage(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.repondre_reservation_voyage(UUID, BOOLEAN) TO authenticated;

-- Réservations de mon voyage (chauffeur) : nom et téléphone du passager seulement après acceptation.
CREATE OR REPLACE FUNCTION public.lister_reservations_de_mon_voyage(p_voyage_id UUID)
RETURNS TABLE (
  id                 UUID,
  places             INTEGER,
  prise_libelle      TEXT,
  prise_lat          DOUBLE PRECISION,
  prise_lng          DOUBLE PRECISION,
  statut             TEXT,
  passager_nom       TEXT,
  passager_telephone TEXT,
  created_at         TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.voyages v WHERE v.id = p_voyage_id AND v.chauffeur_id = auth.uid()) THEN
    RAISE EXCEPTION 'Ce voyage n''est pas le vôtre.';
  END IF;

  RETURN QUERY
  SELECT
    r.id, r.places, r.prise_libelle, r.prise_lat, r.prise_lng, r.statut,
    CASE WHEN r.statut = 'acceptee' THEN p.full_name END,
    CASE WHEN r.statut = 'acceptee' THEN p.phone END,
    r.created_at
  FROM public.voyages_reservations r
  LEFT JOIN public.profiles p ON p.id = r.passager_id
  WHERE r.voyage_id = p_voyage_id
  ORDER BY r.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.lister_reservations_de_mon_voyage(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lister_reservations_de_mon_voyage(UUID) TO authenticated;

-- Le chauffeur de ma réservation ACCEPTÉE : nom, téléphone, véhicule, plaque (sécurité du passager).
CREATE OR REPLACE FUNCTION public.infos_chauffeur_de_ma_reservation(p_reservation_id UUID)
RETURNS TABLE (
  chauffeur_nom   TEXT,
  telephone       TEXT,
  type_vehicule   TEXT,
  marque_modele   TEXT,
  immatriculation TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;

  RETURN QUERY
  SELECT p.full_name, c.telephone, c.type_vehicule, c.marque_modele, c.immatriculation
  FROM public.voyages_reservations r
  JOIN public.voyages v ON v.id = r.voyage_id
  JOIN public.chauffeurs c ON c.user_id = v.chauffeur_id
  LEFT JOIN public.profiles p ON p.id = v.chauffeur_id
  WHERE r.id = p_reservation_id AND r.passager_id = auth.uid() AND r.statut = 'acceptee';
END;
$$;

REVOKE ALL ON FUNCTION public.infos_chauffeur_de_ma_reservation(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.infos_chauffeur_de_ma_reservation(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Annuler / partir / position / terminer (chauffeur du voyage)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.annuler_voyage(p_voyage_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_v   public.voyages;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;
  SELECT * INTO v_v FROM public.voyages WHERE id = p_voyage_id AND chauffeur_id = v_moi FOR UPDATE;
  IF v_v.id IS NULL THEN
    RAISE EXCEPTION 'Voyage introuvable.';
  END IF;
  IF v_v.statut IS DISTINCT FROM 'ouvert' THEN
    RAISE EXCEPTION 'Seul un voyage qui n''est pas encore parti peut être annulé.';
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  SELECT r.passager_id, v_moi, 'voyage', 'Le voyage vers ' || v_v.destination_libelle || ' a été annulé par le chauffeur.', '/marketplace'
  FROM public.voyages_reservations r WHERE r.voyage_id = v_v.id AND r.statut IN ('en_attente', 'acceptee');

  UPDATE public.voyages_reservations SET statut = 'annulee', updated_at = now()
  WHERE voyage_id = v_v.id AND statut IN ('en_attente', 'acceptee');
  UPDATE public.voyages SET statut = 'annule', updated_at = now() WHERE id = v_v.id;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.annuler_voyage(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.annuler_voyage(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.demarrer_voyage(p_voyage_id UUID)
RETURNS public.voyages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_v   public.voyages;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.chauffeurs WHERE user_id = v_moi AND statut = 'actif') THEN
    RAISE EXCEPTION 'Réservé aux chauffeurs validés.';
  END IF;
  SELECT * INTO v_v FROM public.voyages WHERE id = p_voyage_id AND chauffeur_id = v_moi FOR UPDATE;
  IF v_v.id IS NULL THEN
    RAISE EXCEPTION 'Voyage introuvable.';
  END IF;
  IF v_v.statut IS DISTINCT FROM 'ouvert' THEN
    RAISE EXCEPTION 'Ce voyage est déjà parti, terminé ou annulé.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.voyages_reservations r WHERE r.voyage_id = v_v.id AND r.statut = 'acceptee') THEN
    RAISE EXCEPTION 'Acceptez au moins une réservation avant de partir.';
  END IF;

  -- Réservations restées sans réponse : refusées d'office, les passagers sont prévenus.
  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  SELECT r.passager_id, v_moi, 'voyage', 'Le chauffeur est parti sans pouvoir répondre à votre demande pour ' || v_v.destination_libelle || '.', '/marketplace'
  FROM public.voyages_reservations r WHERE r.voyage_id = v_v.id AND r.statut = 'en_attente';
  UPDATE public.voyages_reservations SET statut = 'refusee', updated_at = now() WHERE voyage_id = v_v.id AND statut = 'en_attente';

  -- Les passagers acceptés savent que la tournée démarre et peuvent suivre le chauffeur.
  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  SELECT r.passager_id, v_moi, 'voyage', 'Votre chauffeur est parti : suivez-le sur la carte (voyage vers ' || v_v.destination_libelle || ').', '/marketplace'
  FROM public.voyages_reservations r WHERE r.voyage_id = v_v.id AND r.statut = 'acceptee';

  INSERT INTO public.voyages_positions (voyage_id, lat, lng, maj_le)
  VALUES (v_v.id, v_v.depart_lat, v_v.depart_lng, now())
  ON CONFLICT (voyage_id) DO UPDATE SET lat = excluded.lat, lng = excluded.lng, maj_le = now();

  UPDATE public.voyages SET statut = 'en_route', updated_at = now() WHERE id = v_v.id RETURNING * INTO v_v;
  RETURN v_v;
END;
$$;

REVOKE ALL ON FUNCTION public.demarrer_voyage(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.demarrer_voyage(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.mettre_a_jour_position_voyage(p_voyage_id UUID, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;
  IF p_lat IS NULL OR p_lng IS NULL OR p_lat NOT BETWEEN 12.2 AND 16.8 OR p_lng NOT BETWEEN -17.9 AND -11.2 THEN
    RAISE EXCEPTION 'Position hors du Sénégal.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.voyages v WHERE v.id = p_voyage_id AND v.chauffeur_id = v_moi AND v.statut = 'en_route') THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.voyages_positions (voyage_id, lat, lng, maj_le)
  VALUES (p_voyage_id, p_lat, p_lng, now())
  ON CONFLICT (voyage_id) DO UPDATE SET lat = excluded.lat, lng = excluded.lng, maj_le = now();
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.mettre_a_jour_position_voyage(UUID, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mettre_a_jour_position_voyage(UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

CREATE OR REPLACE FUNCTION public.terminer_voyage(p_voyage_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_v   public.voyages;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;
  SELECT * INTO v_v FROM public.voyages WHERE id = p_voyage_id AND chauffeur_id = v_moi FOR UPDATE;
  IF v_v.id IS NULL THEN
    RAISE EXCEPTION 'Voyage introuvable.';
  END IF;
  IF v_v.statut IS DISTINCT FROM 'en_route' THEN
    RAISE EXCEPTION 'Seul un voyage en route peut être terminé.';
  END IF;

  UPDATE public.voyages SET statut = 'termine', updated_at = now() WHERE id = v_v.id;
  -- La position en direct n'a plus de raison d'être lue : on la supprime.
  DELETE FROM public.voyages_positions WHERE voyage_id = v_v.id;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.terminer_voyage(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.terminer_voyage(UUID) TO authenticated;

-- Ni le public ni les visiteurs anonymes ne peuvent appeler les fonctions de modération
-- (elles revérifient aussi le rôle en interne : double barrière).
REVOKE ALL ON FUNCTION public.approve_chauffeur_request(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_chauffeur_request(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.suspend_chauffeur(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_chauffeur_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_chauffeur_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suspend_chauffeur(UUID, TEXT) TO authenticated;
