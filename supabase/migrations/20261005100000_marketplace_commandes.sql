-- Commande Marketplace : la notion n'existe pas encore en base.
--
-- Le parcours d'achat actuel (« Commande rapide » dans ModalFicheProduit)
-- s'arrête à un lien wa.me vers le vendeur — rien n'est persisté. Cette
-- migration fait exister la commande elle-même, préalable au circuit
-- livreur (accréditation, tableau de livraisons, suivi de position) qui
-- vient par-dessus dans les migrations suivantes.
--
-- CHOIX STRUCTURANTS
--
-- 1. Confirmation à deux mains. Le statut distingue 'livree_declaree'
--    (le livreur dit avoir livré) de 'livree' (l'acheteur a confirmé avoir
--    reçu) — décision produit explicite : un livreur seul ne peut pas
--    clôturer une commande où du cash circule.
--
-- 2. Facilité ne gère aucun argent de cette commande. Pas de colonne
--    « payé »/« montant dû » : l'article et les frais de livraison se
--    règlent directement entre acheteur/vendeur/livreur à la remise, comme
--    aujourd'hui par WhatsApp. `moyen_paiement` est informatif seulement.
--
-- 3. Position du livreur mutable en continu, à l'inverse de la position
--    boutique (verrouillée après le premier relevé, migration
--    20260902220000). Un livreur qui bouge pendant une livraison est un cas
--    réellement nouveau dans ce dépôt : livreur_position_lat/lng sont
--    réécrits à chaque mise à jour (voir migration position_livraison).
--
-- 4. Prix figé à la commande (prix_unitaire_xof/prix_total_xof copiés
--    depuis l'article au moment de la création) : si le vendeur change son
--    prix ensuite, l'historique de la commande ne doit pas bouger
--    rétroactivement.

CREATE TABLE IF NOT EXISTS public.marketplace_commandes (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id                UUID NOT NULL REFERENCES public.marketplace_items(id) ON DELETE CASCADE,
  store_id               UUID NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  acheteur_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quantite               INTEGER NOT NULL CHECK (quantite > 0),
  prix_unitaire_xof      INTEGER NOT NULL CHECK (prix_unitaire_xof >= 0),
  prix_total_xof         INTEGER NOT NULL CHECK (prix_total_xof >= 0),
  frais_livraison_xof    INTEGER NOT NULL DEFAULT 0 CHECK (frais_livraison_xof >= 0),
  livraison_nom          TEXT NOT NULL CHECK (btrim(livraison_nom) <> ''),
  livraison_telephone    TEXT NOT NULL CHECK (btrim(livraison_telephone) <> ''),
  livraison_adresse      TEXT NOT NULL CHECK (btrim(livraison_adresse) <> ''),
  -- Informatif uniquement : Facilité ne gère aucun paiement de cette
  -- commande (voir choix structurant 2 ci-dessus).
  moyen_paiement         TEXT NOT NULL CHECK (moyen_paiement IN ('wave', 'om', 'livraison')),
  statut                 TEXT NOT NULL DEFAULT 'en_attente_livreur' CHECK (statut IN (
                           'en_attente_livreur', 'assignee', 'recuperee',
                           'en_livraison', 'livree_declaree', 'livree', 'annulee'
                         )),
  livreur_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  livreur_position_lat   DOUBLE PRECISION CHECK (livreur_position_lat IS NULL OR (livreur_position_lat BETWEEN -90 AND 90)),
  livreur_position_lng   DOUBLE PRECISION CHECK (livreur_position_lng IS NULL OR (livreur_position_lng BETWEEN -180 AND 180)),
  livreur_position_maj_le TIMESTAMPTZ,
  assignee_le            TIMESTAMPTZ,
  recuperee_le           TIMESTAMPTZ,
  en_livraison_le        TIMESTAMPTZ,
  livree_declaree_le     TIMESTAMPTZ,
  livree_le              TIMESTAMPTZ,
  annulee_le             TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_commandes_acheteur ON public.marketplace_commandes(acheteur_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_commandes_store ON public.marketplace_commandes(store_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_commandes_livreur ON public.marketplace_commandes(livreur_id) WHERE livreur_id IS NOT NULL;
-- Le tableau des livraisons disponibles balaie ce sous-ensemble en premier.
CREATE INDEX IF NOT EXISTS idx_marketplace_commandes_en_attente
  ON public.marketplace_commandes(created_at) WHERE statut = 'en_attente_livreur';

ALTER TABLE public.marketplace_commandes ENABLE ROW LEVEL SECURITY;

-- Une commande n'est visible que par les trois parties concernées (acheteur,
-- vendeur, livreur assigné) et les administrateurs — jamais un autre vendeur
-- ni un livreur non assigné (eux passent par lister_livraisons_disponibles,
-- qui ne révèle ni adresse ni téléphone avant réclamation).
DROP POLICY IF EXISTS "parties prenantes lisent leur commande" ON public.marketplace_commandes;
CREATE POLICY "parties prenantes lisent leur commande"
  ON public.marketplace_commandes FOR SELECT
  TO authenticated
  USING (
    acheteur_id = auth.uid()
    OR livreur_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.marketplace_stores s
      WHERE s.id = marketplace_commandes.store_id AND s.owner_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

-- Aucune policy d'écriture : toute transition passe par une fonction
-- SECURITY DEFINER (celle ci-dessous, puis celles de la migration suivante),
-- et aucun GRANT INSERT/UPDATE/DELETE n'est accordé (invariant 1).
GRANT SELECT ON public.marketplace_commandes TO authenticated;

-- Indispensable pour que postgres_changes reçoive quoi que ce soit côté
-- acheteur (suivi en direct du livreur) : seules les tables ajoutées à
-- cette publication sont diffusées, quelle que soit la policy RLS — qui
-- continue de filtrer QUI reçoit quoi parmi les abonnés (vérifié isolément
-- structurel par la migration 20260814050000).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'marketplace_commandes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_commandes;
  END IF;
END $$;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'jobs', 'posts', 'mentions', 'candidature', 'reponse',
    'badge', 'message', 'system', 'document_access', 'document_delivery',
    'support_escalade', 'marketplace_signalement', 'marketplace_commande'
  ]));

-- ---------------------------------------------------------------------------
-- Créer une commande (acheteur)
-- ---------------------------------------------------------------------------
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

  SELECT i.store_id, i.prix_xof, s.owner_id
  INTO v_store, v_prix, v_vendeur
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

REVOKE ALL ON FUNCTION public.creer_commande_marketplace(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.creer_commande_marketplace(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated;
