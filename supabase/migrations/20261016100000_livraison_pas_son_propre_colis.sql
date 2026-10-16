-- Un livreur ne peut pas livrer SA PROPRE commande.
--
-- Constat (état des lieux de la livraison, 16/10/2026) : un utilisateur à la fois
-- livreur actif et acheteur pouvait réclamer sa propre commande, la faire avancer
-- jusqu'à « livrée » puis la confirmer lui-même. La confirmation à deux mains
-- (livreur déclare, acheteur confirme) perdait alors tout son sens.
--
-- Trois barrières, de la plus visible à la plus profonde :
--  1. le tableau des livraisons disponibles n'affiche plus ses propres commandes ;
--  2. reclamer_livraison refuse avec un message clair ;
--  3. une contrainte CHECK sur la table interdit livreur_id = acheteur_id par
--     quelque chemin que ce soit (réclamation, acceptation dans un groupage,
--     écriture directe) — c'est elle qui garantit la règle, les deux autres
--     ne font que bien l'expliquer. Aucune commande existante ne la viole (vérifié).
--
-- Les deux fonctions sont redéfinies à l'identique de 20261015120000 (qui ignorait
-- déjà les commandes groupées), plus la règle ci-dessus.

ALTER TABLE public.marketplace_commandes
  DROP CONSTRAINT IF EXISTS marketplace_commandes_livreur_pas_acheteur;
ALTER TABLE public.marketplace_commandes
  ADD CONSTRAINT marketplace_commandes_livreur_pas_acheteur
  CHECK (livreur_id IS DISTINCT FROM acheteur_id);

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
    AND c.acheteur_id IS DISTINCT FROM auth.uid()
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
  -- Message clair avant la contrainte de la table (qui reste la vraie garantie).
  IF EXISTS (SELECT 1 FROM public.marketplace_commandes WHERE id = p_commande_id AND acheteur_id = v_moi) THEN
    RAISE EXCEPTION 'Vous ne pouvez pas livrer votre propre commande.';
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
