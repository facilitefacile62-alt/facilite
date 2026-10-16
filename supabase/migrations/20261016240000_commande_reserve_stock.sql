-- Réserver automatiquement le stock à la commande.
--
-- Avant : le stock était vérifié (20261016160000) mais jamais décrémenté ; deux acheteurs pouvaient
-- commander en même temps la dernière pièce.
--
-- Maintenant : la quantité commandée est RETIRÉE du stock de l'article dès l'enregistrement de la
-- commande, et REMISE si la commande est annulée — quelle que soit la voie (annulation de
-- l'acheteur, décision de l'administrateur, expiration automatique), car tout passe par le statut
-- « annulee ». Deux acheteurs ne peuvent plus prendre la même dernière pièce : la mise à jour du
-- stock est atomique, le second reçoit « Stock insuffisant ».
--
-- CHANGEMENT POUR LES VENDEURS : le stock affiché est désormais ce qui reste DISPONIBLE. Le vendeur
-- ne doit plus retirer à la main les pièces d'une commande reçue sur Facilité (elles le sont déjà) ;
-- il continue de corriger le stock pour les ventes faites ailleurs.
--
-- Aucune écriture directe n'est accordée aux clients : ce sont des déclencheurs SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.reserver_stock_commande()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.statut = 'annulee' THEN
    RETURN NEW;
  END IF;
  UPDATE public.marketplace_items
  SET quantite = quantite - NEW.quantite
  WHERE id = NEW.item_id AND quantite >= NEW.quantite;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock insuffisant : un autre acheteur vient de prendre les dernières pièces de cet article.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.rendre_stock_commande_annulee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.statut = 'annulee' AND OLD.statut IS DISTINCT FROM 'annulee' THEN
    UPDATE public.marketplace_items SET quantite = quantite + NEW.quantite WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reserver_stock_commande() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rendre_stock_commande_annulee() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_commande_reserve_stock ON public.marketplace_commandes;
CREATE TRIGGER trg_commande_reserve_stock
  AFTER INSERT ON public.marketplace_commandes
  FOR EACH ROW EXECUTE FUNCTION public.reserver_stock_commande();

DROP TRIGGER IF EXISTS trg_commande_rend_stock ON public.marketplace_commandes;
CREATE TRIGGER trg_commande_rend_stock
  AFTER UPDATE OF statut ON public.marketplace_commandes
  FOR EACH ROW EXECUTE FUNCTION public.rendre_stock_commande_annulee();
