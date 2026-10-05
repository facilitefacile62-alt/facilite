-- Machine à états des livraisons (Point 6/12 du chantier « livraison
-- Marketplace ») : un livreur accrédité (public.livreurs, statut='actif')
-- découvre les commandes en attente, en réclame une, puis la fait avancer
-- jusqu'à la confirmation de l'acheteur.
--
-- Tableau de réclamation manuelle, pas de dispatch automatique façon Uber :
-- plus simple et plus sûr pour une v1, pas de moteur de matching à inventer
-- ni à faire confiance.
--
-- Confidentialité avant engagement : lister_livraisons_disponibles ne
-- renvoie jamais l'adresse ni le téléphone de l'acheteur — seulement le
-- point de retrait (boutique), le prix et la distance. Ces informations ne
-- sont révélées qu'après reclamer_livraison, exactement comme les
-- applications de livraison grand public jugent si la course vaut le coup
-- avant de voir la destination.

ALTER TABLE public.marketplace_commandes ADD COLUMN IF NOT EXISTS motif_annulation TEXT;

-- ---------------------------------------------------------------------------
-- Tableau des livraisons disponibles (livreur)
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
    AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
    AND public.distance_km(p_lat, p_lng, s.latitude, s.longitude) <= p_rayon_km
  ORDER BY public.distance_km(p_lat, p_lng, s.latitude, s.longitude) ASC, c.created_at ASC
  LIMIT greatest(1, least(coalesce(p_limite, 40), 100));
END;
$$;

REVOKE ALL ON FUNCTION public.lister_livraisons_disponibles(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lister_livraisons_disponibles(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- Réclamer / libérer une livraison
-- ---------------------------------------------------------------------------
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

  -- Condition WHERE livreur_id IS NULL : un UPDATE concurrent échoue
  -- silencieusement (0 ligne), jamais une course entre deux livreurs sur la
  -- même commande.
  UPDATE public.marketplace_commandes
  SET livreur_id = v_moi, statut = 'assignee', assignee_le = now()
  WHERE id = p_commande_id AND livreur_id IS NULL AND statut = 'en_attente_livreur'
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

-- Soupape anti-blocage : sans elle, un livreur qui réclame une commande puis
-- disparaît la bloque indéfiniment (assignee sans retour possible).
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

  -- Uniquement avant le retrait physique (statut 'assignee') : au-delà, le
  -- livreur a déjà l'article en main, se libérer n'a plus de sens.
  UPDATE public.marketplace_commandes
  SET livreur_id = NULL, statut = 'en_attente_livreur', assignee_le = NULL
  WHERE id = p_commande_id AND livreur_id = v_moi AND statut = 'assignee';

  RETURN FOUND;
END;
$$;

-- ---------------------------------------------------------------------------
-- Progression de la livraison (livreur assigné uniquement)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marquer_livraison_recuperee(p_commande_id UUID)
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

  UPDATE public.marketplace_commandes
  SET statut = 'recuperee', recuperee_le = now()
  WHERE id = p_commande_id AND livreur_id = v_moi AND statut = 'assignee';

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.demarrer_livraison(p_commande_id UUID)
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

  UPDATE public.marketplace_commandes
  SET statut = 'en_livraison', en_livraison_le = now()
  WHERE id = p_commande_id AND livreur_id = v_moi AND statut = 'recuperee';

  RETURN FOUND;
END;
$$;

-- Le livreur DÉCLARE la livraison faite (livree_declaree) ; seule la
-- confirmation de l'acheteur (confirmer_reception_commande) clôture
-- vraiment la commande (livree) — décision produit explicite : un livreur
-- seul ne peut pas clôturer une commande où du cash circule.
CREATE OR REPLACE FUNCTION public.marquer_livraison_livree(p_commande_id UUID)
RETURNS BOOLEAN
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

  UPDATE public.marketplace_commandes
  SET statut = 'livree_declaree', livree_declaree_le = now()
  WHERE id = p_commande_id AND livreur_id = v_moi AND statut = 'en_livraison'
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  VALUES (v_row.acheteur_id, v_moi, 'marketplace_commande', 'Votre colis a été marqué comme livré — confirmez sa réception.', '/marketplace?onglet=acheter');

  RETURN true;
END;
$$;

-- ---------------------------------------------------------------------------
-- Confirmation de réception (acheteur uniquement)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirmer_reception_commande(p_commande_id UUID)
RETURNS BOOLEAN
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

  UPDATE public.marketplace_commandes
  SET statut = 'livree', livree_le = now()
  WHERE id = p_commande_id AND acheteur_id = v_moi AND statut = 'livree_declaree'
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  SELECT s.owner_id, v_moi, 'marketplace_commande', 'Livraison confirmée par l''acheteur.', '/marketplace?onglet=vendre&tab=commandes'
  FROM public.marketplace_stores s WHERE s.id = v_row.store_id;

  IF v_row.livreur_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, actor_id, type, content, link)
    VALUES (v_row.livreur_id, v_moi, 'marketplace_commande', 'Livraison confirmée par l''acheteur.', '/marketplace?onglet=livrer');
  END IF;

  RETURN true;
END;
$$;

-- ---------------------------------------------------------------------------
-- Annulation (acheteur uniquement, avant retrait physique)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.annuler_commande_marketplace(p_commande_id UUID, p_motif TEXT DEFAULT NULL)
RETURNS BOOLEAN
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

  UPDATE public.marketplace_commandes
  SET statut = 'annulee', annulee_le = now(), motif_annulation = nullif(btrim(coalesce(p_motif, '')), '')
  WHERE id = p_commande_id AND acheteur_id = v_moi AND statut IN ('en_attente_livreur', 'assignee')
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  SELECT s.owner_id, v_moi, 'marketplace_commande', 'Une commande a été annulée par l''acheteur.', '/marketplace?onglet=vendre&tab=commandes'
  FROM public.marketplace_stores s WHERE s.id = v_row.store_id;

  IF v_row.livreur_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, actor_id, type, content, link)
    VALUES (v_row.livreur_id, v_moi, 'marketplace_commande', 'Une commande que vous aviez réclamée a été annulée.', '/marketplace?onglet=livrer');
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.reclamer_livraison(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.liberer_livraison(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.marquer_livraison_recuperee(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.demarrer_livraison(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.marquer_livraison_livree(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirmer_reception_commande(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.annuler_commande_marketplace(UUID, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.reclamer_livraison(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.liberer_livraison(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marquer_livraison_recuperee(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.demarrer_livraison(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marquer_livraison_livree(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirmer_reception_commande(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.annuler_commande_marketplace(UUID, TEXT) TO authenticated;
