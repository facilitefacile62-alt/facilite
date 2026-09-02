-- Types d'activité, statuts en direct et tickets de consultation.
--
-- Rien de tout cela n'existait : ni type ENUM, ni colonne métier sur profiles,
-- ni table de tickets. Cette migration pose le socle dont dépendent les quatre
-- interfaces (candidat, point Wave, pharmacie, clinique).
--
-- POURQUOI SUR profiles PLUTÔT QUE SUR establishments
--
-- `establishments` existe mais ne porte que name/address/phone/email : ni
-- coordonnées, ni propriétaire, ni statut. C'est un annuaire en lecture seule,
-- alimenté par migration, sans lien avec un compte. Or un point Wave qui
-- bascule son statut doit être authentifié : le statut appartient à quelqu'un.
-- On étend donc profiles, qui est déjà clé par auth.users.
--
-- POURQUOI DEUX TABLES POUR LES CLINIQUES
--
-- L'énoncé parle de « créer des tickets de consultation (spécialité, tarif) »
-- côté clinique, et « d'acheter un ticket avec numéro d'ordre » côté patient.
-- Ce sont deux objets différents : une prestation proposée, et un ticket émis.
-- Les confondre dans une seule table obligerait à des lignes-modèles sans
-- patient, qu'il faudrait exclure de chaque requête — la source de bugs
-- classique. D'où clinic_services (l'offre) et clinic_tickets (l'émis).

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'user_activity_type') THEN
    CREATE TYPE public.user_activity_type AS ENUM ('candidate', 'wave_point', 'pharmacy', 'clinic');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'pharmacy_status') THEN
    CREATE TYPE public.pharmacy_status AS ENUM ('open', 'closed', 'on_duty');
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- Profil : type d'activité et statut en direct
-- ---------------------------------------------------------------------------
-- `candidate` par défaut : les 193 comptes existants restent des candidats,
-- aucun écran ne change pour eux tant qu'ils n'ont rien déclaré.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS activity_type public.user_activity_type NOT NULL DEFAULT 'candidate',
  -- Point Wave : ouvert ou fermé, rien d'autre. Un interrupteur.
  ADD COLUMN IF NOT EXISTS is_open BOOLEAN NOT NULL DEFAULT false,
  -- Pharmacie : trois états, dont la garde, qui n'est ni « ouvert » ni
  -- « fermé » — c'est ouvert la nuit, et c'est l'information que les gens
  -- cherchent en urgence.
  ADD COLUMN IF NOT EXISTS pharmacy_status public.pharmacy_status,
  -- Position de l'établissement, pour la carte des lieux ouverts. Distincte
  -- de profiles.location (texte libre saisi par la personne).
  ADD COLUMN IF NOT EXISTS activity_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS activity_longitude DOUBLE PRECISION,
  -- Quand le statut a changé. C'est ce qui permet d'afficher « ouvert,
  -- confirmé il y a 10 min » plutôt qu'un « ouvert » dont personne ne sait
  -- s'il date de ce matin ou du mois dernier.
  ADD COLUMN IF NOT EXISTS activity_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_activite_ouverte
  ON public.profiles (activity_type)
  WHERE activity_type <> 'candidate' AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Prestations proposées par une clinique
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinic_services (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  specialite TEXT NOT NULL,
  tarif_xof  INTEGER NOT NULL CHECK (tarif_xof >= 0),
  actif      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clinic_services_clinique ON public.clinic_services (clinic_id, actif);

ALTER TABLE public.clinic_services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prestations actives visibles de tous" ON public.clinic_services;
CREATE POLICY "prestations actives visibles de tous"
  ON public.clinic_services FOR SELECT
  USING (actif = true OR clinic_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Tickets émis
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinic_tickets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id   UUID REFERENCES public.clinic_services(id) ON DELETE SET NULL,
  -- Spécialité et tarif sont RECOPIÉS, pas seulement référencés : une clinique
  -- qui change son tarif demain ne doit pas réécrire le prix d'un ticket déjà
  -- payé. Un ticket est une trace, pas une vue sur l'offre courante.
  specialite   TEXT NOT NULL,
  tarif_xof    INTEGER NOT NULL CHECK (tarif_xof >= 0),
  -- Numéro d'ordre remis à zéro chaque jour, par clinique.
  jour         DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  numero_ordre INTEGER NOT NULL,
  statut       TEXT NOT NULL DEFAULT 'en_attente'
                 CHECK (statut IN ('en_attente', 'en_consultation', 'termine', 'annule')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Deux patients ne peuvent pas porter le même numéro le même jour dans la
  -- même clinique. C'est la contrainte qui rend la file crédible.
  UNIQUE (clinic_id, jour, numero_ordre)
);
CREATE INDEX IF NOT EXISTS idx_clinic_tickets_file
  ON public.clinic_tickets (clinic_id, jour, numero_ordre);
CREATE INDEX IF NOT EXISTS idx_clinic_tickets_patient
  ON public.clinic_tickets (patient_id, created_at DESC);

ALTER TABLE public.clinic_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "un ticket est visible du patient et de la clinique" ON public.clinic_tickets;
CREATE POLICY "un ticket est visible du patient et de la clinique"
  ON public.clinic_tickets FOR SELECT
  TO authenticated
  USING (patient_id = auth.uid() OR clinic_id = auth.uid());

-- Aucune policy d'écriture, aucun GRANT INSERT/UPDATE/DELETE : tout passe par
-- les fonctions ci-dessous (invariant 1 — la liste blanche est vide).
GRANT SELECT ON public.clinic_services TO anon, authenticated;
GRANT SELECT ON public.clinic_tickets  TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_clinic_tickets()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_clinic_tickets_touch ON public.clinic_tickets;
CREATE TRIGGER trg_clinic_tickets_touch
  BEFORE UPDATE ON public.clinic_tickets
  FOR EACH ROW EXECUTE FUNCTION public.touch_clinic_tickets();

-- ---------------------------------------------------------------------------
-- Déclarer son type d'activité
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.definir_mon_activite(
  p_type public.user_activity_type,
  p_lat  DOUBLE PRECISION DEFAULT NULL,
  p_lng  DOUBLE PRECISION DEFAULT NULL
)
RETURNS public.user_activity_type
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_moi UUID := auth.uid();
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'Connexion requise.'; END IF;

  UPDATE public.profiles
  SET activity_type = p_type,
      activity_latitude = coalesce(p_lat, activity_latitude),
      activity_longitude = coalesce(p_lng, activity_longitude),
      -- Repasser candidat éteint le statut : laisser `is_open = true` sur un
      -- ancien point Wave le ferait apparaître ouvert pour toujours.
      is_open = CASE WHEN p_type = 'candidate' THEN false ELSE is_open END,
      pharmacy_status = CASE WHEN p_type = 'pharmacy' THEN coalesce(pharmacy_status, 'closed') ELSE NULL END,
      activity_updated_at = now()
  WHERE id = v_moi;

  RETURN p_type;
END;
$$;
REVOKE ALL ON FUNCTION public.definir_mon_activite(public.user_activity_type, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_mon_activite(public.user_activity_type, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- ---------------------------------------------------------------------------
-- Basculer son statut en direct
-- ---------------------------------------------------------------------------
-- Une seule fonction pour les deux métiers : le point Wave passe un booléen,
-- la pharmacie passe un état. Chacun ne peut écrire que le champ qui le
-- concerne — une pharmacie ne bascule pas `is_open`, un point Wave n'a pas de
-- garde.
CREATE OR REPLACE FUNCTION public.majr_mon_statut(
  p_is_open BOOLEAN DEFAULT NULL,
  p_statut  public.pharmacy_status DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_moi  UUID := auth.uid();
  v_type public.user_activity_type;
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'Connexion requise.'; END IF;
  SELECT activity_type INTO v_type FROM public.profiles WHERE id = v_moi;

  IF v_type = 'wave_point' THEN
    IF p_is_open IS NULL THEN RAISE EXCEPTION 'Statut manquant.'; END IF;
    UPDATE public.profiles
    SET is_open = p_is_open, activity_updated_at = now()
    WHERE id = v_moi;
  ELSIF v_type = 'pharmacy' THEN
    IF p_statut IS NULL THEN RAISE EXCEPTION 'Statut manquant.'; END IF;
    UPDATE public.profiles
    SET pharmacy_status = p_statut,
        -- `is_open` reste cohérent pour la carte : une pharmacie de garde est
        -- ouverte. Sans cette ligne, la carte devrait connaître les règles de
        -- chaque métier.
        is_open = (p_statut IN ('open', 'on_duty')),
        activity_updated_at = now()
    WHERE id = v_moi;
  ELSE
    RAISE EXCEPTION 'Votre compte n''a pas de statut en direct.';
  END IF;

  RETURN (SELECT jsonb_build_object(
            'activity_type', p.activity_type,
            'is_open', p.is_open,
            'pharmacy_status', p.pharmacy_status,
            'maj_le', p.activity_updated_at)
          FROM public.profiles p WHERE p.id = v_moi);
END;
$$;
REVOKE ALL ON FUNCTION public.majr_mon_statut(BOOLEAN, public.pharmacy_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.majr_mon_statut(BOOLEAN, public.pharmacy_status) TO authenticated;

-- ---------------------------------------------------------------------------
-- Carte des établissements ouverts
-- ---------------------------------------------------------------------------
-- Réutilise public.distance_km, déjà en place pour le transport et la
-- Marketplace : une seule formule de distance dans tout le projet.
CREATE OR REPLACE FUNCTION public.etablissements_ouverts_proches(
  p_lat      DOUBLE PRECISION,
  p_lng      DOUBLE PRECISION,
  p_rayon_km DOUBLE PRECISION DEFAULT 10,
  p_type     public.user_activity_type DEFAULT NULL
)
RETURNS TABLE (
  id              UUID,
  nom             TEXT,
  activity_type   public.user_activity_type,
  is_open         BOOLEAN,
  pharmacy_status public.pharmacy_status,
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  quartier        TEXT,
  telephone       TEXT,
  maj_le          TIMESTAMPTZ,
  distance_km     DOUBLE PRECISION
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT
    p.id, p.full_name, p.activity_type, p.is_open, p.pharmacy_status,
    p.activity_latitude, p.activity_longitude, p.quartier, p.phone,
    p.activity_updated_at,
    round(public.distance_km(p_lat, p_lng, p.activity_latitude, p.activity_longitude)::numeric, 2)::double precision
  FROM public.profiles p
  WHERE p.deleted_at IS NULL
    AND p.activity_type <> 'candidate'
    AND p.activity_latitude IS NOT NULL
    AND p.activity_longitude IS NOT NULL
    AND (p_type IS NULL OR p.activity_type = p_type)
    AND public.distance_km(p_lat, p_lng, p.activity_latitude, p.activity_longitude) <= p_rayon_km
  ORDER BY p.is_open DESC,
           public.distance_km(p_lat, p_lng, p.activity_latitude, p.activity_longitude) ASC
  LIMIT 60;
$$;
REVOKE ALL ON FUNCTION public.etablissements_ouverts_proches(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, public.user_activity_type) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.etablissements_ouverts_proches(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, public.user_activity_type) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Une clinique publie une prestation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enregistrer_prestation(p_specialite TEXT, p_tarif INTEGER)
RETURNS public.clinic_services
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_row public.clinic_services;
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'Connexion requise.'; END IF;
  IF (SELECT activity_type FROM public.profiles WHERE id = v_moi) <> 'clinic' THEN
    RAISE EXCEPTION 'Réservé aux cliniques.';
  END IF;
  IF btrim(coalesce(p_specialite, '')) = '' THEN
    RAISE EXCEPTION 'La spécialité est obligatoire.';
  END IF;

  INSERT INTO public.clinic_services (clinic_id, specialite, tarif_xof)
  VALUES (v_moi, btrim(p_specialite), greatest(0, coalesce(p_tarif, 0)))
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.enregistrer_prestation(TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_prestation(TEXT, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.retirer_prestation(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_moi UUID := auth.uid();
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'Connexion requise.'; END IF;
  UPDATE public.clinic_services SET actif = false
  WHERE id = p_id AND clinic_id = v_moi;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.retirer_prestation(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retirer_prestation(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Un patient prend un ticket
-- ---------------------------------------------------------------------------
-- Le numéro d'ordre est attribué sous verrou consultatif : deux patients qui
-- valident à la même seconde recevraient sinon le même numéro, et la file
-- perdrait tout sens. pg_advisory_xact_lock sérialise par clinique et par
-- jour, pas globalement — deux cliniques ne s'attendent pas.
CREATE OR REPLACE FUNCTION public.prendre_ticket(p_service_id UUID)
RETURNS public.clinic_tickets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_moi     UUID := auth.uid();
  v_service public.clinic_services;
  v_jour    DATE := (now() AT TIME ZONE 'UTC')::date;
  v_numero  INTEGER;
  v_row     public.clinic_tickets;
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'Connexion requise.'; END IF;

  SELECT * INTO v_service FROM public.clinic_services WHERE id = p_service_id AND actif = true;
  IF v_service.id IS NULL THEN RAISE EXCEPTION 'Prestation introuvable ou retirée.'; END IF;
  IF v_service.clinic_id = v_moi THEN
    RAISE EXCEPTION 'Une clinique ne prend pas de ticket chez elle-même.';
  END IF;

  -- Un seul ticket en attente par patient et par clinique le même jour :
  -- sinon un patient occupe plusieurs places dans la file.
  IF EXISTS (
    SELECT 1 FROM public.clinic_tickets t
    WHERE t.patient_id = v_moi AND t.clinic_id = v_service.clinic_id
      AND t.jour = v_jour AND t.statut IN ('en_attente', 'en_consultation')
  ) THEN
    RAISE EXCEPTION 'Vous avez déjà un ticket en cours dans cette clinique aujourd''hui.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_service.clinic_id::text || v_jour::text));

  SELECT coalesce(max(numero_ordre), 0) + 1 INTO v_numero
  FROM public.clinic_tickets
  WHERE clinic_id = v_service.clinic_id AND jour = v_jour;

  INSERT INTO public.clinic_tickets
    (clinic_id, patient_id, service_id, specialite, tarif_xof, jour, numero_ordre)
  VALUES
    (v_service.clinic_id, v_moi, v_service.id, v_service.specialite, v_service.tarif_xof, v_jour, v_numero)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.prendre_ticket(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prendre_ticket(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- La clinique fait avancer sa file
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.majr_statut_ticket(p_id UUID, p_statut TEXT)
RETURNS public.clinic_tickets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_row public.clinic_tickets;
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'Connexion requise.'; END IF;
  IF p_statut NOT IN ('en_attente', 'en_consultation', 'termine', 'annule') THEN
    RAISE EXCEPTION 'Statut invalide : %.', p_statut;
  END IF;

  -- La clinique fait avancer la file ; le patient ne peut qu'annuler le sien.
  UPDATE public.clinic_tickets t
  SET statut = p_statut
  WHERE t.id = p_id
    AND (t.clinic_id = v_moi OR (t.patient_id = v_moi AND p_statut = 'annule'))
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Ticket introuvable ou action non autorisée.'; END IF;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.majr_statut_ticket(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.majr_statut_ticket(UUID, TEXT) TO authenticated;
