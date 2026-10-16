-- Faire expirer les commandes que aucun livreur n'a prises.
--
-- Constat (état des lieux de la livraison, 16/10/2026) : une commande « en attente d'un livreur »
-- le restait indéfiniment (0 cas en production à ce jour). L'acheteur attendait sans fin, alors que
-- le vendeur n'a peut-être plus l'article.
--
-- CHOIX : après 48 h sans livreur, la commande est annulée automatiquement et l'acheteur et le
-- vendeur sont prévenus. Seules les commandes encore « en_attente_livreur » sont touchées : dès
-- qu'un livreur en a pris une, elle n'expire jamais. La fonction n'est appelable que par le serveur
-- (service_role, via la tâche planifiée /api/cron/expirer-commandes-sans-livreur), jamais par un client.

CREATE OR REPLACE FUNCTION public.expirer_commandes_sans_livreur()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_n INTEGER := 0;
  r   RECORD;
BEGIN
  FOR r IN
    SELECT c.id, c.acheteur_id, s.owner_id AS vendeur_id
    FROM public.marketplace_commandes c
    JOIN public.marketplace_stores s ON s.id = c.store_id
    WHERE c.statut = 'en_attente_livreur' AND c.created_at < now() - interval '48 hours'
    FOR UPDATE OF c SKIP LOCKED
  LOOP
    UPDATE public.marketplace_commandes
    SET statut = 'annulee', annulee_le = now(),
        motif_annulation = 'Aucun livreur disponible sous 48 h : commande expirée automatiquement'
    WHERE id = r.id AND statut = 'en_attente_livreur';

    INSERT INTO public.notifications (user_id, actor_id, type, content, link)
    VALUES (r.acheteur_id, NULL, 'marketplace_commande',
            'Aucun livreur n''a pris votre commande sous 48 h : elle a été annulée. Vous pouvez la repasser ou contacter le vendeur.',
            '/marketplace?onglet=acheter');
    INSERT INTO public.notifications (user_id, actor_id, type, content, link)
    VALUES (r.vendeur_id, NULL, 'marketplace_commande',
            'Une commande de votre boutique a expiré : aucun livreur ne l''a prise sous 48 h.',
            '/marketplace?onglet=vendre&tab=commandes');
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.expirer_commandes_sans_livreur() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expirer_commandes_sans_livreur() TO service_role;
