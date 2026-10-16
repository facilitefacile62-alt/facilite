-- Vérifier le stock à la commande.
--
-- Constat (état des lieux de la livraison, 16/10/2026) : on pouvait commander 50 pièces d'un
-- article dont il en restait 2, et commander un article épuisé (stock 0) : la quantité n'était
-- jamais comparée au stock.
--
-- CHOIX : on VÉRIFIE le stock, on ne le DÉCRÉMENTE PAS. Le vendeur continue de gérer son stock
-- lui-même (maj_stock_article) ; décrémenter aussi ici ferait compter deux fois une pièce vendue
-- que le vendeur retire à la main, et il faudrait la rendre à chaque annulation. Reste donc un
-- cas non couvert, assumé : deux acheteurs qui commandent en même temps la dernière pièce
-- (le vendeur voit les deux commandes et tranche). Une réservation automatique du stock est
-- possible plus tard si tu le souhaites.
--
-- La fonction est redéfinie à l'identique de 20261016140000, plus cette vérification.

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
  v_stock   INTEGER;
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

  SELECT i.store_id, i.prix_xof, i.quantite, s.owner_id, s.latitude, s.longitude
  INTO v_store, v_prix, v_stock, v_vendeur, v_lat, v_lng
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
  -- Le stock est vérifié : on ne commande ni un article épuisé, ni plus de pièces qu'il n'en reste.
  IF v_stock <= 0 THEN
    RAISE EXCEPTION 'Cet article est épuisé.';
  END IF;
  IF p_quantite > v_stock THEN
    RAISE EXCEPTION 'Stock insuffisant : il ne reste que % pièce(s) de cet article.', v_stock;
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
