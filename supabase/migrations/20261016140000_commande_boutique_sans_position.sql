-- Refuser une commande dont la boutique n'a pas de position GPS.
--
-- Constat (état des lieux de la livraison, 16/10/2026) : le tableau des livraisons ne montre
-- aux livreurs que les commandes dont la boutique a une position (latitude/longitude), sinon
-- impossible de calculer la distance de retrait. Une commande passée à une boutique sans
-- position restait donc « en attente d'un livreur » pour toujours, invisible de tous.
--
-- Aujourd'hui les 9 boutiques actives ont une position (vérifié), mais rien n'empêchait qu'une
-- future boutique n'en ait pas. La commande est maintenant refusée AVANT d'être enregistrée,
-- avec un message clair — l'acheteur sait tout de suite qu'il doit passer par le vendeur
-- (le message WhatsApp reste disponible, il part en parallèle de l'enregistrement).
--
-- La fonction est redéfinie à l'identique de 20261005100000, plus cette vérification.

CREATE OR REPLACE FUNCTION public.creer_commande_marketplace(
  p_item_id             UUID,
  p_quantite            INTEGER,
  p_livraison_nom       TEXT,
  p_livraison_telephone TEXT,
  p_livraison_adresse   TEXT,
  p_moyen_paiement      TEXT,
  p_frais_livraison_xof INTEGER DEFAULT 0
)
RETURNS public.marketplace_commandes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi     UUID := auth.uid();
  v_store   UUID;
  v_vendeur UUID;
  v_prix    INTEGER;
  v_lat     DOUBLE PRECISION;
  v_lng     DOUBLE PRECISION;
  v_row     public.marketplace_commandes;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise pour commander.';
  END IF;
  IF coalesce(p_quantite, 0) <= 0 THEN
    RAISE EXCEPTION 'Quantité invalide.';
  END IF;
  IF btrim(coalesce(p_livraison_nom, '')) = '' OR btrim(coalesce(p_livraison_telephone, '')) = ''
     OR btrim(coalesce(p_livraison_adresse, '')) = '' THEN
    RAISE EXCEPTION 'Nom, téléphone et adresse de livraison sont obligatoires.';
  END IF;

  SELECT i.store_id, i.prix_xof, s.owner_id, s.latitude, s.longitude
  INTO v_store, v_prix, v_vendeur, v_lat, v_lng
  FROM public.marketplace_items i
  JOIN public.marketplace_stores s ON s.id = i.store_id
  WHERE i.id = p_item_id AND i.actif = true;

  IF v_store IS NULL THEN
    RAISE EXCEPTION 'Article introuvable.';
  END IF;
  -- Commander sa propre annonce n'a aucun sens et pollue le tableau vendeur.
  IF v_vendeur = v_moi THEN
    RAISE EXCEPTION 'Vous ne pouvez pas commander votre propre article.';
  END IF;
  -- Sans position de la boutique aucun livreur ne verrait la commande : on le dit tout de suite.
  IF v_lat IS NULL OR v_lng IS NULL THEN
    RAISE EXCEPTION 'Cette boutique n''a pas encore indiqué sa position : aucun livreur ne pourrait récupérer la commande. Contactez directement le vendeur.';
  END IF;

  INSERT INTO public.marketplace_commandes (
    item_id, store_id, acheteur_id, quantite,
    prix_unitaire_xof, prix_total_xof, frais_livraison_xof,
    livraison_nom, livraison_telephone, livraison_adresse, moyen_paiement
  )
  VALUES (
    p_item_id, v_store, v_moi, p_quantite,
    v_prix, v_prix * p_quantite, greatest(0, coalesce(p_frais_livraison_xof, 0)),
    btrim(p_livraison_nom), btrim(p_livraison_telephone), btrim(p_livraison_adresse),
    p_moyen_paiement
  )
  RETURNING * INTO v_row;

  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  VALUES (
    v_vendeur, v_moi, 'marketplace_commande',
    'Nouvelle commande reçue sur votre boutique',
    '/marketplace?onglet=vendre'
  );

  RETURN v_row;
END;
$$;
