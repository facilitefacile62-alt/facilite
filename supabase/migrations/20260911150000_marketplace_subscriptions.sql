-- Abonnements d'un acheteur à une boutique (Marketplace) — préalable au
-- système de notification "nouvelle publication d'une boutique suivie"
-- demandé par l'utilisateur. L'onglet "Abonnés" côté vendeur
-- (MarketplaceClient.jsx, VueVendeur/ModalFicheBoutique) n'affichait jusqu'ici
-- qu'un texte d'état vide : aucune table, aucun bouton "S'abonner" côté
-- acheteur n'existaient avant cette migration.
--
-- Une seule ligne par (acheteur, boutique) — UNIQUE ci-dessous fait aussi
-- office de garde-fou applicatif : un "S'abonner" cliqué deux fois échoue
-- silencieusement au lieu de dupliquer.
--
-- Pas de GRANT DELETE direct à authenticated : vérification empirique faite
-- lors de l'écriture de cette migration (Invariant 1 du dépôt), AUCUNE table
-- de ce projet n'accorde UPDATE/DELETE à authenticated/anon — toute
-- suppression de ligne existante passe par une fonction SECURITY DEFINER
-- dédiée (voir se_desabonner_boutique plus bas), même schéma que
-- is_admin/deduct_credit/approve_badge_request. Le "S'abonner" (INSERT) reste
-- un GRANT direct : seul UPDATE/DELETE est concerné par cette règle.

CREATE TABLE IF NOT EXISTS public.marketplace_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, store_id)
);

-- Deux sens de lecture distincts, deux index : "à quelles boutiques suis-je
-- abonné" (acheteur, clé user_id) et "qui est abonné à ma boutique" (vendeur,
-- clé store_id — c'est aussi la clé balayée par le futur trigger de
-- fan-out des notifications à la publication d'un article, Point 3).
CREATE INDEX IF NOT EXISTS idx_marketplace_subscriptions_user ON public.marketplace_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_subscriptions_store ON public.marketplace_subscriptions(store_id);

ALTER TABLE public.marketplace_subscriptions ENABLE ROW LEVEL SECURITY;

-- Un acheteur voit la liste des boutiques auxquelles il est abonné.
DROP POLICY IF EXISTS "Un acheteur lit ses propres abonnements" ON public.marketplace_subscriptions;
CREATE POLICY "Un acheteur lit ses propres abonnements" ON public.marketplace_subscriptions
  FOR SELECT USING ((select auth.uid()) = user_id);

-- Un vendeur voit qui est abonné à SA boutique (alimente l'onglet "Abonnés",
-- Point 4) — distinct de la policy ci-dessus, sinon un vendeur ne verrait
-- jamais les abonnements des autres utilisateurs sur sa propre boutique.
DROP POLICY IF EXISTS "Un vendeur lit les abonnes de sa boutique" ON public.marketplace_subscriptions;
CREATE POLICY "Un vendeur lit les abonnes de sa boutique" ON public.marketplace_subscriptions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.marketplace_stores s
            WHERE s.id = marketplace_subscriptions.store_id AND s.owner_id = (select auth.uid()))
  );

-- Un acheteur s'abonne lui-même — jamais au nom d'un tiers.
DROP POLICY IF EXISTS "Un acheteur cree son propre abonnement" ON public.marketplace_subscriptions;
CREATE POLICY "Un acheteur cree son propre abonnement" ON public.marketplace_subscriptions
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- GRANT explicite requis depuis la correction DEFAULT PRIVILEGES
-- (20260807130000) — une table neuve n'hérite plus rien pour
-- anon/authenticated, les policies RLS ci-dessus n'ont sinon rien à filtrer.
-- DELETE volontairement absent (voir commentaire de tête) : la suppression
-- passe par se_desabonner_boutique() ci-dessous, pas par un GRANT table.
GRANT SELECT, INSERT ON public.marketplace_subscriptions TO authenticated;

-- Désabonnement — fonction dédiée plutôt qu'un GRANT DELETE direct (voir
-- commentaire de tête). `p_store_id` est le seul paramètre reçu du client ;
-- `user_id` vient toujours de auth.uid(), jamais du client, pour qu'un
-- utilisateur ne puisse désabonner personne d'autre que lui-même.
CREATE OR REPLACE FUNCTION public.se_desabonner_boutique(p_store_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.marketplace_subscriptions
  WHERE user_id = auth.uid() AND store_id = p_store_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.se_desabonner_boutique(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.se_desabonner_boutique(uuid) TO authenticated;
