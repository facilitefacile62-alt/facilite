-- Tarif de livraison fixé par Facilité.
--
-- Une table à UNE seule ligne porte le tarif : un montant fixe par livraison, en FCFA. Il vaut 0
-- tant que l'administrateur n'en a pas fixé un (aucun tarif n'est inventé ici) : le comportement
-- actuel est donc inchangé jusqu'à ce que tu le définisses (écran Administration > Tarif de
-- livraison). Chaque nouvelle commande reçoit le tarif EN VIGUEUR à ce moment ; les commandes
-- passées gardent le leur. Facilité ne perçoit pas ce montant : il est affiché à l'acheteur et au
-- livreur, qui se règlent directement (comme le reste de la livraison).
--
-- Lecture via lire_tarif_livraison (utilisateurs connectés), écriture réservée aux administrateurs via
-- definir_tarif_livraison (invariant 1 : aucun droit direct sur la table).
-- creer_commande_marketplace est redéfinie à l'identique de 20261016180000, sauf les frais.

CREATE TABLE IF NOT EXISTS public.livraison_tarif (
  id         BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  frais_xof  INTEGER NOT NULL DEFAULT 0 CHECK (frais_xof BETWEEN 0 AND 50000),
  modifie_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  modifie_par UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
INSERT INTO public.livraison_tarif (id, frais_xof) VALUES (true, 0) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.livraison_tarif ENABLE ROW LEVEL SECURITY;
-- Aucune policy ni aucun droit : la table n'est lue et modifiée que par les deux fonctions ci-dessous
-- (une policy « lisible par tous » serait une policy tautologique, refusée par l'invariant 7).
DROP POLICY IF EXISTS "tarif lisible par les connectés" ON public.livraison_tarif;
REVOKE ALL ON public.livraison_tarif FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.lire_tarif_livraison()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce((SELECT frais_xof FROM public.livraison_tarif WHERE id = true), 0);
$$;

REVOKE ALL ON FUNCTION public.lire_tarif_livraison() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lire_tarif_livraison() TO authenticated;

CREATE OR REPLACE FUNCTION public.definir_tarif_livraison(p_frais_xof INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
BEGIN
  IF v_moi IS NULL OR NOT public.is_admin(v_moi) THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;
  IF p_frais_xof IS NULL OR p_frais_xof < 0 OR p_frais_xof > 50000 THEN
    RAISE EXCEPTION 'Le tarif doit être compris entre 0 et 50 000 FCFA.';
  END IF;
  UPDATE public.livraison_tarif SET frais_xof = p_frais_xof, modifie_le = now(), modifie_par = v_moi WHERE id = true;
  PERFORM public.log_security_event('livraison_tarif_modifie', 'info', v_moi, NULL, jsonb_build_object('frais_xof', p_frais_xof));
  RETURN p_frais_xof;
END;
$$;

REVOKE ALL ON FUNCTION public.definir_tarif_livraison(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_tarif_livraison(INTEGER) TO authenticated;

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
  v_frais   INTEGER;
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

  -- Frais de livraison : le tarif de Facilité, jamais une valeur fournie par le client.
  SELECT frais_xof INTO v_frais FROM public.livraison_tarif WHERE id = true;
  v_frais := coalesce(v_frais, 0);

  INSERT INTO public.marketplace_commandes (
    item_id, store_id, acheteur_id, quantite,
    prix_unitaire_xof, prix_total_xof, frais_livraison_xof,
    livraison_nom, livraison_telephone, livraison_adresse, moyen_paiement
  )
  VALUES (
    p_item_id, v_store, v_moi, p_quantite,
    v_prix, v_prix * p_quantite, v_frais,
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
