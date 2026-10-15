-- Notifications manquantes du groupage (point 4 du chantier). Le point 1
-- (20261015120000) prévenait déjà : le livreur quand une commande demande à
-- rejoindre sa tournée, l'acheteur quand le livreur accepte ou refuse, et les
-- acheteurs en cas d'annulation ou de refus d'office au départ. Il restait trois
-- silences :
--   1. au départ, les acheteurs dont la commande est ACCEPTÉE n'étaient pas
--      prévenus que le livreur était parti ;
--   2. à l'acceptation, le vendeur n'était pas prévenu qu'un livreur allait venir
--      récupérer la commande (réclamer_livraison le fait, pas repondre_commande_groupage) ;
--   3. quand un acheteur retirait sa commande, le livreur n'en savait rien.
-- Les trois fonctions sont redéfinies à l'identique, plus ces notifications.
-- Aucun changement de signature, de droits ni de logique de statut.

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

  -- Le vendeur doit savoir qu'un livreur va venir (comme avec reclamer_livraison).
  IF p_accepter THEN
    INSERT INTO public.notifications (user_id, actor_id, type, content, link)
    SELECT s.owner_id, v_moi, 'marketplace_commande', 'Un livreur va récupérer une commande dans votre boutique.', '/marketplace?onglet=vendre&tab=commandes'
    FROM public.marketplace_stores s WHERE s.id = v_row.store_id;
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.detacher_commande_de_groupage(p_commande_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi     UUID := auth.uid();
  v_livreur UUID;
  v_dest    TEXT;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;

  -- Le livreur à prévenir est lu AVANT la mise à jour : le rattachement est effacé par celle-ci.
  SELECT g.livreur_id, g.destination_libelle INTO v_livreur, v_dest
  FROM public.marketplace_commandes c
  JOIN public.marketplace_groupages g ON g.id = c.groupage_id
  WHERE c.id = p_commande_id AND c.acheteur_id = v_moi AND g.statut = 'ouvert';

  UPDATE public.marketplace_commandes c
  SET groupage_id = NULL, groupage_decision = NULL, livreur_id = NULL,
      statut = 'en_attente_livreur', assignee_le = NULL,
      livraison_lat = NULL, livraison_lng = NULL
  WHERE c.id = p_commande_id AND c.acheteur_id = v_moi
    AND c.groupage_id IS NOT NULL
    AND c.statut IN ('en_attente_livreur', 'assignee')
    AND EXISTS (SELECT 1 FROM public.marketplace_groupages g WHERE g.id = c.groupage_id AND g.statut = 'ouvert');

  IF FOUND AND v_livreur IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, actor_id, type, content, link)
    VALUES (v_livreur, v_moi, 'marketplace_commande', 'Un acheteur a retiré sa commande de votre groupage vers ' || v_dest || '.', '/marketplace?onglet=livrer');
    RETURN TRUE;
  END IF;

  RETURN FOUND;
END;
$$;

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

  -- Les acheteurs dont la commande est acceptée savent que la tournée est partie.
  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  SELECT c.acheteur_id, v_moi, 'marketplace_commande', 'Le livreur est parti : votre commande est en route vers ' || v_g.destination_libelle || '.', '/marketplace?onglet=acheter'
  FROM public.marketplace_commandes c WHERE c.groupage_id = v_g.id AND c.groupage_decision = 'acceptee';

  UPDATE public.marketplace_groupages SET statut = 'en_route', updated_at = now() WHERE id = v_g.id RETURNING * INTO v_g;
  RETURN v_g;
END;
$$;
