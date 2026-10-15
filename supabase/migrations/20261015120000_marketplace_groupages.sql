-- Groupage Marketplace (Locaux) : un livreur annonce UNE tournée — position de
-- départ, heure (par exemple 16 h), destination (par exemple Keur Massar),
-- nombre de places et prix par livraison. Les acheteurs dont la commande va
-- dans cette direction la rattachent à la tournée : au lieu de payer une
-- course individuelle, ils se partagent le trajet du livreur.
--
-- Il s'appuie sur le circuit existant (marketplace_commandes, livreurs,
-- machine à états de livraison, suivi de position). Rien n'est réécrit, sauf
-- trois fonctions (voir la fin) qui doivent désormais IGNORER les commandes
-- rattachées à un groupage : sans cela, n'importe quel autre livreur pourrait
-- les voir et les réclamer dans le tableau général.
--
-- CHOIX (validés avec le propriétaire)
--  1. Prix : le livreur fixe un prix par livraison ; acheteur et livreur
--     règlent entre eux à la remise. Facilité ne gère aucun argent (même
--     principe que marketplace_commandes).
--  2. Qui peut rejoindre : la boutique est à moins de rayon_depart_km du point
--     de départ ET le lieu de livraison de l'acheteur est à moins de
--     rayon_destination_km de la destination. Une tournée = un seul trajet.
--  3. Le livreur accepte ou refuse chaque commande avant le départ. Au départ,
--     toute commande restée sans réponse est refusée d'office et retourne dans
--     le tableau général.
--
-- Aucune écriture directe : la table n'accorde que SELECT (invariant 1) ; tout
-- passe par des fonctions SECURITY DEFINER qui revérifient l'identité en
-- interne.

CREATE TABLE IF NOT EXISTS public.marketplace_groupages (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livreur_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  depart_libelle         TEXT NOT NULL CHECK (char_length(btrim(depart_libelle)) BETWEEN 1 AND 80),
  depart_lat             DOUBLE PRECISION NOT NULL CHECK (depart_lat BETWEEN -90 AND 90),
  depart_lng             DOUBLE PRECISION NOT NULL CHECK (depart_lng BETWEEN -180 AND 180),
  destination_libelle    TEXT NOT NULL CHECK (char_length(btrim(destination_libelle)) BETWEEN 1 AND 80),
  destination_lat        DOUBLE PRECISION NOT NULL CHECK (destination_lat BETWEEN -90 AND 90),
  destination_lng        DOUBLE PRECISION NOT NULL CHECK (destination_lng BETWEEN -180 AND 180),
  heure_depart           TIMESTAMPTZ NOT NULL,
  places_max             INTEGER NOT NULL CHECK (places_max BETWEEN 1 AND 30),
  frais_par_livraison_xof INTEGER NOT NULL DEFAULT 0 CHECK (frais_par_livraison_xof BETWEEN 0 AND 100000),
  rayon_depart_km        NUMERIC NOT NULL DEFAULT 3 CHECK (rayon_depart_km BETWEEN 0.5 AND 15),
  rayon_destination_km   NUMERIC NOT NULL DEFAULT 5 CHECK (rayon_destination_km BETWEEN 1 AND 30),
  note                   TEXT CHECK (note IS NULL OR char_length(note) <= 200),
  statut                 TEXT NOT NULL DEFAULT 'ouvert' CHECK (statut IN ('ouvert', 'en_route', 'termine', 'annule')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_groupages_livreur ON public.marketplace_groupages(livreur_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_groupages_ouverts ON public.marketplace_groupages(heure_depart) WHERE statut = 'ouvert';

ALTER TABLE public.marketplace_groupages ENABLE ROW LEVEL SECURITY;

-- Les tournées annoncées ou en cours sont visibles de tout utilisateur connecté
-- (c'est tout l'intérêt : les acheteurs doivent les trouver) ; le livreur voit
-- aussi les siennes terminées ou annulées ; les administrateurs voient tout.
DROP POLICY IF EXISTS "groupages ouverts visibles aux connectes" ON public.marketplace_groupages;
CREATE POLICY "groupages ouverts visibles aux connectes"
  ON public.marketplace_groupages FOR SELECT
  TO authenticated
  USING (
    statut IN ('ouvert', 'en_route')
    OR livreur_id = auth.uid()
    OR public.is_admin(auth.uid())
  );

REVOKE ALL ON public.marketplace_groupages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.marketplace_groupages TO authenticated;

-- ---------------------------------------------------------------------------
-- Colonnes ajoutées aux commandes
-- ---------------------------------------------------------------------------
-- livraison_lat/lng : la commande n'avait qu'une adresse écrite ; pour savoir si
-- elle est dans la zone d'un groupage, l'acheteur donne le point de livraison.
ALTER TABLE public.marketplace_commandes ADD COLUMN IF NOT EXISTS groupage_id UUID REFERENCES public.marketplace_groupages(id) ON DELETE SET NULL;
ALTER TABLE public.marketplace_commandes ADD COLUMN IF NOT EXISTS groupage_decision TEXT;
ALTER TABLE public.marketplace_commandes ADD COLUMN IF NOT EXISTS livraison_lat DOUBLE PRECISION;
ALTER TABLE public.marketplace_commandes ADD COLUMN IF NOT EXISTS livraison_lng DOUBLE PRECISION;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_commandes_groupage_decision_check') THEN
    ALTER TABLE public.marketplace_commandes ADD CONSTRAINT marketplace_commandes_groupage_decision_check
      CHECK (groupage_decision IS NULL OR groupage_decision IN ('en_attente', 'acceptee', 'refusee'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_commandes_livraison_coords_check') THEN
    ALTER TABLE public.marketplace_commandes ADD CONSTRAINT marketplace_commandes_livraison_coords_check
      CHECK (
        (livraison_lat IS NULL AND livraison_lng IS NULL)
        OR (livraison_lat BETWEEN -90 AND 90 AND livraison_lng BETWEEN -180 AND 180)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_marketplace_commandes_groupage ON public.marketplace_commandes(groupage_id) WHERE groupage_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Annoncer un groupage (livreur accrédité)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publier_groupage(
  p_depart_libelle        TEXT,
  p_depart_lat            DOUBLE PRECISION,
  p_depart_lng            DOUBLE PRECISION,
  p_destination_libelle   TEXT,
  p_destination_lat       DOUBLE PRECISION,
  p_destination_lng       DOUBLE PRECISION,
  p_heure_depart          TIMESTAMPTZ,
  p_places_max            INTEGER,
  p_frais_xof             INTEGER,
  p_rayon_depart_km       NUMERIC DEFAULT 3,
  p_rayon_destination_km  NUMERIC DEFAULT 5,
  p_note                  TEXT DEFAULT NULL
)
RETURNS public.marketplace_groupages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_row public.marketplace_groupages;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.livreurs WHERE user_id = v_moi AND statut = 'actif') THEN
    RAISE EXCEPTION 'Réservé aux livreurs accrédités.';
  END IF;

  IF char_length(btrim(coalesce(p_depart_libelle, ''))) NOT BETWEEN 1 AND 80
     OR char_length(btrim(coalesce(p_destination_libelle, ''))) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Le départ et la destination doivent être nommés (80 caractères maximum).';
  END IF;
  -- Même cadre que l'itinéraire Marketplace : Sénégal (voir api/marketplace/itineraire).
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
  IF coalesce(p_places_max, 0) NOT BETWEEN 1 AND 30 THEN
    RAISE EXCEPTION 'Le nombre de places doit être compris entre 1 et 30.';
  END IF;
  IF coalesce(p_frais_xof, -1) NOT BETWEEN 0 AND 100000 THEN
    RAISE EXCEPTION 'Le prix par livraison doit être compris entre 0 et 100 000 FCFA.';
  END IF;
  IF coalesce(p_rayon_depart_km, 0) NOT BETWEEN 0.5 AND 15 OR coalesce(p_rayon_destination_km, 0) NOT BETWEEN 1 AND 30 THEN
    RAISE EXCEPTION 'Rayons invalides (départ 0,5 à 15 km, destination 1 à 30 km).';
  END IF;
  IF p_note IS NOT NULL AND char_length(p_note) > 200 THEN
    RAISE EXCEPTION 'La note fait 200 caractères au maximum.';
  END IF;
  -- Anti-spam : pas plus de 3 groupages ouverts à la fois par livreur.
  IF (SELECT count(*) FROM public.marketplace_groupages WHERE livreur_id = v_moi AND statut = 'ouvert') >= 3 THEN
    RAISE EXCEPTION 'Vous avez déjà 3 groupages ouverts : terminez-en ou annulez-en un.';
  END IF;

  INSERT INTO public.marketplace_groupages (
    livreur_id, depart_libelle, depart_lat, depart_lng,
    destination_libelle, destination_lat, destination_lng,
    heure_depart, places_max, frais_par_livraison_xof,
    rayon_depart_km, rayon_destination_km, note
  )
  VALUES (
    v_moi, btrim(p_depart_libelle), p_depart_lat, p_depart_lng,
    btrim(p_destination_libelle), p_destination_lat, p_destination_lng,
    p_heure_depart, p_places_max, p_frais_xof,
    p_rayon_depart_km, p_rayon_destination_km, nullif(btrim(coalesce(p_note, '')), '')
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.publier_groupage(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TIMESTAMPTZ, INTEGER, INTEGER, NUMERIC, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publier_groupage(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TIMESTAMPTZ, INTEGER, INTEGER, NUMERIC, NUMERIC, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Chercher les groupages qui vont vers un point (acheteur)
-- ---------------------------------------------------------------------------
-- p_lat/p_lng = le lieu où l'acheteur veut être livré. dans_la_zone dit si ce
-- point est dans le rayon de destination du groupage (donc rejoignable) ; les
-- groupages un peu plus loin (jusqu'à p_rayon_km) restent listés pour info.
CREATE OR REPLACE FUNCTION public.rechercher_groupages(
  p_lat      DOUBLE PRECISION,
  p_lng      DOUBLE PRECISION,
  p_rayon_km DOUBLE PRECISION DEFAULT 25,
  p_limite   INTEGER DEFAULT 30
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
  frais_par_livraison_xof INTEGER,
  rayon_depart_km         NUMERIC,
  rayon_destination_km    NUMERIC,
  note                    TEXT,
  livreur_prenom          TEXT,
  type_vehicule           TEXT,
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
    g.id, g.depart_libelle, g.depart_lat, g.depart_lng,
    g.destination_libelle, g.destination_lat, g.destination_lng,
    g.heure_depart,
    greatest(0, g.places_max - (
      SELECT count(*)::integer FROM public.marketplace_commandes c
      WHERE c.groupage_id = g.id AND c.groupage_decision IN ('en_attente', 'acceptee')
    )),
    g.frais_par_livraison_xof, g.rayon_depart_km, g.rayon_destination_km, g.note,
    nullif(split_part(btrim(coalesce(p.full_name, '')), ' ', 1), ''),
    l.type_vehicule,
    round(public.distance_km(p_lat, p_lng, g.destination_lat, g.destination_lng)::numeric, 2)::double precision,
    public.distance_km(p_lat, p_lng, g.destination_lat, g.destination_lng) <= g.rayon_destination_km::double precision
  FROM public.marketplace_groupages g
  LEFT JOIN public.livreurs l ON l.user_id = g.livreur_id
  LEFT JOIN public.profiles p ON p.id = g.livreur_id
  WHERE g.statut = 'ouvert'
    AND g.heure_depart > now()
    AND public.distance_km(p_lat, p_lng, g.destination_lat, g.destination_lng) <= greatest(p_rayon_km, g.rayon_destination_km::double precision)
  ORDER BY g.heure_depart ASC
  LIMIT greatest(1, least(coalesce(p_limite, 30), 100));
END;
$$;

REVOKE ALL ON FUNCTION public.rechercher_groupages(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rechercher_groupages(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- Rattacher une commande à un groupage (acheteur)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rattacher_commande_a_groupage(
  p_commande_id UUID,
  p_groupage_id UUID,
  p_lat         DOUBLE PRECISION,
  p_lng         DOUBLE PRECISION
)
RETURNS public.marketplace_commandes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi       UUID := auth.uid();
  v_g         public.marketplace_groupages;
  v_store_lat DOUBLE PRECISION;
  v_store_lng DOUBLE PRECISION;
  v_row       public.marketplace_commandes;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;
  IF p_lat IS NULL OR p_lng IS NULL OR p_lat NOT BETWEEN 12.2 AND 16.8 OR p_lng NOT BETWEEN -17.9 AND -11.2 THEN
    RAISE EXCEPTION 'Indiquez un lieu de livraison au Sénégal.';
  END IF;

  -- Verrou sur la tournée : deux acheteurs ne peuvent pas prendre la dernière place en même temps.
  SELECT * INTO v_g FROM public.marketplace_groupages WHERE id = p_groupage_id FOR UPDATE;
  IF v_g.id IS NULL OR v_g.statut IS DISTINCT FROM 'ouvert' OR v_g.heure_depart <= now() THEN
    RAISE EXCEPTION 'Ce groupage n''est plus ouvert.';
  END IF;
  IF v_g.livreur_id = v_moi THEN
    RAISE EXCEPTION 'Vous ne pouvez pas rejoindre votre propre groupage.';
  END IF;

  SELECT s.latitude, s.longitude INTO v_store_lat, v_store_lng
  FROM public.marketplace_commandes c
  JOIN public.marketplace_stores s ON s.id = c.store_id
  WHERE c.id = p_commande_id AND c.acheteur_id = v_moi
    AND c.statut = 'en_attente_livreur' AND c.livreur_id IS NULL AND c.groupage_id IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande introuvable ou déjà prise en charge.';
  END IF;
  IF v_store_lat IS NULL OR v_store_lng IS NULL THEN
    RAISE EXCEPTION 'La boutique n''a pas de position : impossible de la rattacher à un trajet.';
  END IF;

  IF public.distance_km(v_store_lat, v_store_lng, v_g.depart_lat, v_g.depart_lng) > v_g.rayon_depart_km::double precision THEN
    RAISE EXCEPTION 'La boutique est trop loin du point de départ de ce groupage.';
  END IF;
  IF public.distance_km(p_lat, p_lng, v_g.destination_lat, v_g.destination_lng) > v_g.rayon_destination_km::double precision THEN
    RAISE EXCEPTION 'Votre lieu de livraison est hors de la zone de destination de ce groupage.';
  END IF;
  IF (
    SELECT count(*) FROM public.marketplace_commandes c
    WHERE c.groupage_id = v_g.id AND c.groupage_decision IN ('en_attente', 'acceptee')
  ) >= v_g.places_max THEN
    RAISE EXCEPTION 'Ce groupage est complet.';
  END IF;

  UPDATE public.marketplace_commandes
  SET groupage_id = v_g.id, groupage_decision = 'en_attente',
      livraison_lat = p_lat, livraison_lng = p_lng,
      frais_livraison_xof = v_g.frais_par_livraison_xof
  WHERE id = p_commande_id
  RETURNING * INTO v_row;

  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  VALUES (v_g.livreur_id, v_moi, 'marketplace_commande', 'Une commande demande à rejoindre votre groupage vers ' || v_g.destination_libelle || '.', '/marketplace?onglet=livrer');

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.rattacher_commande_a_groupage(UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rattacher_commande_a_groupage(UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- Retirer sa commande d'un groupage encore ouvert : elle retourne dans le tableau général.
CREATE OR REPLACE FUNCTION public.detacher_commande_de_groupage(p_commande_id UUID)
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

  UPDATE public.marketplace_commandes c
  SET groupage_id = NULL, groupage_decision = NULL, livreur_id = NULL,
      statut = 'en_attente_livreur', assignee_le = NULL,
      livraison_lat = NULL, livraison_lng = NULL
  WHERE c.id = p_commande_id AND c.acheteur_id = v_moi
    AND c.groupage_id IS NOT NULL
    AND c.statut IN ('en_attente_livreur', 'assignee')
    AND EXISTS (SELECT 1 FROM public.marketplace_groupages g WHERE g.id = c.groupage_id AND g.statut = 'ouvert');

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.detacher_commande_de_groupage(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.detacher_commande_de_groupage(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Accepter / refuser une commande (livreur de la tournée)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.repondre_commande_groupage(p_commande_id UUID, p_accepter BOOLEAN)
RETURNS public.marketplace_commandes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_row public.marketplace_commandes;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.livreurs WHERE user_id = v_moi AND statut = 'actif') THEN
    RAISE EXCEPTION 'Réservé aux livreurs accrédités.';
  END IF;
  IF p_accepter IS NULL THEN
    RAISE EXCEPTION 'Réponse manquante.';
  END IF;

  IF p_accepter THEN
    UPDATE public.marketplace_commandes c
    SET livreur_id = v_moi, statut = 'assignee', assignee_le = now(), groupage_decision = 'acceptee'
    WHERE c.id = p_commande_id AND c.groupage_decision = 'en_attente' AND c.livreur_id IS NULL
      AND EXISTS (SELECT 1 FROM public.marketplace_groupages g WHERE g.id = c.groupage_id AND g.livreur_id = v_moi AND g.statut = 'ouvert')
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.marketplace_commandes c
    SET groupage_id = NULL, groupage_decision = 'refusee', livraison_lat = NULL, livraison_lng = NULL
    WHERE c.id = p_commande_id AND c.groupage_decision = 'en_attente' AND c.livreur_id IS NULL
      AND EXISTS (SELECT 1 FROM public.marketplace_groupages g WHERE g.id = c.groupage_id AND g.livreur_id = v_moi AND g.statut = 'ouvert')
    RETURNING * INTO v_row;
  END IF;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Cette commande n''attend plus votre réponse.';
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  VALUES (
    v_row.acheteur_id, v_moi, 'marketplace_commande',
    CASE WHEN p_accepter THEN 'Le livreur a accepté votre commande dans son groupage.'
         ELSE 'Le livreur n''a pas pu prendre votre commande dans son groupage : elle reste disponible pour d''autres livreurs.' END,
    '/marketplace?onglet=acheter'
  );

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.repondre_commande_groupage(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.repondre_commande_groupage(UUID, BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------------
-- Les commandes de mon groupage (livreur)
-- ---------------------------------------------------------------------------
-- Avant acceptation : ni nom, ni téléphone, ni adresse (même règle de
-- confidentialité que lister_livraisons_disponibles). Après : tout.
CREATE OR REPLACE FUNCTION public.lister_commandes_de_mon_groupage(p_groupage_id UUID)
RETURNS TABLE (
  id                  UUID,
  item_titre          TEXT,
  quantite            INTEGER,
  frais_livraison_xof INTEGER,
  boutique_nom        TEXT,
  boutique_quartier   TEXT,
  boutique_lat        DOUBLE PRECISION,
  boutique_lng        DOUBLE PRECISION,
  groupage_decision   TEXT,
  statut              TEXT,
  acheteur_nom        TEXT,
  acheteur_telephone  TEXT,
  adresse             TEXT,
  livraison_lat       DOUBLE PRECISION,
  livraison_lng       DOUBLE PRECISION,
  created_at          TIMESTAMPTZ
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
  IF NOT EXISTS (SELECT 1 FROM public.marketplace_groupages g WHERE g.id = p_groupage_id AND g.livreur_id = auth.uid()) THEN
    RAISE EXCEPTION 'Ce groupage n''est pas le vôtre.';
  END IF;

  RETURN QUERY
  SELECT
    c.id, i.titre, c.quantite, c.frais_livraison_xof,
    s.nom, s.quartier, s.latitude, s.longitude,
    c.groupage_decision, c.statut,
    CASE WHEN c.groupage_decision = 'acceptee' THEN c.livraison_nom END,
    CASE WHEN c.groupage_decision = 'acceptee' THEN c.livraison_telephone END,
    CASE WHEN c.groupage_decision = 'acceptee' THEN c.livraison_adresse END,
    CASE WHEN c.groupage_decision = 'acceptee' THEN c.livraison_lat END,
    CASE WHEN c.groupage_decision = 'acceptee' THEN c.livraison_lng END,
    c.created_at
  FROM public.marketplace_commandes c
  JOIN public.marketplace_items i ON i.id = c.item_id
  JOIN public.marketplace_stores s ON s.id = c.store_id
  WHERE c.groupage_id = p_groupage_id
  ORDER BY c.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.lister_commandes_de_mon_groupage(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lister_commandes_de_mon_groupage(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Annuler / partir / terminer (livreur de la tournée)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.annuler_groupage(p_groupage_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_g   public.marketplace_groupages;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;
  SELECT * INTO v_g FROM public.marketplace_groupages WHERE id = p_groupage_id AND livreur_id = v_moi FOR UPDATE;
  IF v_g.id IS NULL THEN
    RAISE EXCEPTION 'Groupage introuvable.';
  END IF;
  IF v_g.statut IS DISTINCT FROM 'ouvert' THEN
    RAISE EXCEPTION 'Seul un groupage qui n''est pas encore parti peut être annulé.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.marketplace_commandes c
    WHERE c.groupage_id = v_g.id AND c.statut IN ('recuperee', 'en_livraison', 'livree_declaree', 'livree')
  ) THEN
    RAISE EXCEPTION 'Des articles sont déjà récupérés : terminez ces livraisons avant d''annuler.';
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  SELECT c.acheteur_id, v_moi, 'marketplace_commande', 'Le groupage vers ' || v_g.destination_libelle || ' a été annulé : votre commande reste disponible pour d''autres livreurs.', '/marketplace?onglet=acheter'
  FROM public.marketplace_commandes c WHERE c.groupage_id = v_g.id;

  UPDATE public.marketplace_commandes
  SET groupage_id = NULL, groupage_decision = NULL, livreur_id = NULL,
      statut = 'en_attente_livreur', assignee_le = NULL, livraison_lat = NULL, livraison_lng = NULL
  WHERE groupage_id = v_g.id AND statut IN ('en_attente_livreur', 'assignee');

  UPDATE public.marketplace_groupages SET statut = 'annule', updated_at = now() WHERE id = v_g.id;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.annuler_groupage(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.annuler_groupage(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.demarrer_groupage(p_groupage_id UUID)
RETURNS public.marketplace_groupages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_g   public.marketplace_groupages;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;
  SELECT * INTO v_g FROM public.marketplace_groupages WHERE id = p_groupage_id AND livreur_id = v_moi FOR UPDATE;
  IF v_g.id IS NULL THEN
    RAISE EXCEPTION 'Groupage introuvable.';
  END IF;
  IF v_g.statut IS DISTINCT FROM 'ouvert' THEN
    RAISE EXCEPTION 'Ce groupage est déjà parti, terminé ou annulé.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.marketplace_commandes c WHERE c.groupage_id = v_g.id AND c.groupage_decision = 'acceptee'
  ) THEN
    RAISE EXCEPTION 'Acceptez au moins une commande avant de partir.';
  END IF;

  -- Commandes restées sans réponse : refusées d'office, elles retournent dans le tableau général.
  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  SELECT c.acheteur_id, v_moi, 'marketplace_commande', 'Le livreur est parti sans pouvoir répondre à votre demande de groupage : votre commande reste disponible pour d''autres livreurs.', '/marketplace?onglet=acheter'
  FROM public.marketplace_commandes c WHERE c.groupage_id = v_g.id AND c.groupage_decision = 'en_attente';

  UPDATE public.marketplace_commandes
  SET groupage_id = NULL, groupage_decision = 'refusee', livraison_lat = NULL, livraison_lng = NULL
  WHERE groupage_id = v_g.id AND groupage_decision = 'en_attente';

  UPDATE public.marketplace_groupages SET statut = 'en_route', updated_at = now() WHERE id = v_g.id RETURNING * INTO v_g;
  RETURN v_g;
END;
$$;

REVOKE ALL ON FUNCTION public.demarrer_groupage(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.demarrer_groupage(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.terminer_groupage(p_groupage_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_g   public.marketplace_groupages;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;
  SELECT * INTO v_g FROM public.marketplace_groupages WHERE id = p_groupage_id AND livreur_id = v_moi FOR UPDATE;
  IF v_g.id IS NULL THEN
    RAISE EXCEPTION 'Groupage introuvable.';
  END IF;
  IF v_g.statut IS DISTINCT FROM 'en_route' THEN
    RAISE EXCEPTION 'Seul un groupage en route peut être terminé.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.marketplace_commandes c
    WHERE c.groupage_id = v_g.id AND c.statut IN ('assignee', 'recuperee', 'en_livraison')
  ) THEN
    RAISE EXCEPTION 'Il reste des commandes à livrer dans ce groupage.';
  END IF;

  UPDATE public.marketplace_groupages SET statut = 'termine', updated_at = now() WHERE id = v_g.id;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.terminer_groupage(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.terminer_groupage(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Les trois fonctions existantes qui doivent ignorer les commandes groupées
-- (corps identiques à 20261005130000, plus la condition « groupage_id IS NULL »
-- ou le retour à zéro du rattachement).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lister_livraisons_disponibles(
  p_lat      DOUBLE PRECISION,
  p_lng      DOUBLE PRECISION,
  p_rayon_km DOUBLE PRECISION DEFAULT 15,
  p_limite   INTEGER DEFAULT 40
)
RETURNS TABLE (
  id                  UUID,
  item_titre          TEXT,
  quantite            INTEGER,
  prix_total_xof      INTEGER,
  frais_livraison_xof INTEGER,
  boutique_nom        TEXT,
  boutique_quartier   TEXT,
  boutique_ville      TEXT,
  boutique_lat        DOUBLE PRECISION,
  boutique_lng        DOUBLE PRECISION,
  distance_km         DOUBLE PRECISION,
  created_at          TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.livreurs WHERE user_id = auth.uid() AND statut = 'actif') THEN
    RAISE EXCEPTION 'Réservé aux livreurs accrédités.';
  END IF;

  RETURN QUERY
  SELECT
    c.id, i.titre, c.quantite, c.prix_total_xof, c.frais_livraison_xof,
    s.nom, s.quartier, s.ville, s.latitude, s.longitude,
    round(public.distance_km(p_lat, p_lng, s.latitude, s.longitude)::numeric, 2)::double precision,
    c.created_at
  FROM public.marketplace_commandes c
  JOIN public.marketplace_items i ON i.id = c.item_id
  JOIN public.marketplace_stores s ON s.id = c.store_id
  WHERE c.statut = 'en_attente_livreur'
    AND c.livreur_id IS NULL
    AND c.groupage_id IS NULL
    AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
    AND public.distance_km(p_lat, p_lng, s.latitude, s.longitude) <= p_rayon_km
  ORDER BY public.distance_km(p_lat, p_lng, s.latitude, s.longitude) ASC, c.created_at ASC
  LIMIT greatest(1, least(coalesce(p_limite, 40), 100));
END;
$$;

CREATE OR REPLACE FUNCTION public.reclamer_livraison(p_commande_id UUID)
RETURNS public.marketplace_commandes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_row public.marketplace_commandes;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.livreurs WHERE user_id = v_moi AND statut = 'actif') THEN
    RAISE EXCEPTION 'Réservé aux livreurs accrédités.';
  END IF;

  -- livreur_id IS NULL : un UPDATE concurrent échoue silencieusement (0 ligne).
  -- groupage_id IS NULL : une commande rattachée à un groupage ne se réclame pas
  -- (c'est le livreur de la tournée qui l'accepte ou la refuse).
  UPDATE public.marketplace_commandes
  SET livreur_id = v_moi, statut = 'assignee', assignee_le = now()
  WHERE id = p_commande_id AND livreur_id IS NULL AND groupage_id IS NULL AND statut = 'en_attente_livreur'
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Cette livraison n''est plus disponible.';
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  VALUES (v_row.acheteur_id, v_moi, 'marketplace_commande', 'Un livreur a été assigné à votre commande.', '/marketplace?onglet=acheter');

  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  SELECT s.owner_id, v_moi, 'marketplace_commande', 'Un livreur va récupérer une commande dans votre boutique.', '/marketplace?onglet=vendre&tab=commandes'
  FROM public.marketplace_stores s WHERE s.id = v_row.store_id;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.liberer_livraison(p_commande_id UUID)
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

  -- Uniquement avant le retrait physique (statut 'assignee'). Une commande
  -- sortie d'un groupage retourne dans le tableau général : le rattachement
  -- est effacé, sinon elle resterait invisible des autres livreurs.
  UPDATE public.marketplace_commandes
  SET livreur_id = NULL, statut = 'en_attente_livreur', assignee_le = NULL,
      groupage_id = NULL, groupage_decision = NULL, livraison_lat = NULL, livraison_lng = NULL
  WHERE id = p_commande_id AND livreur_id = v_moi AND statut = 'assignee';

  RETURN FOUND;
END;
$$;
