-- Système de jetons Marketplace : monnaie interne rechargeable (jamais
-- périmée, en réserve) qu'une boutique dépense pour activer 1 an de statut
-- "Premium Marketplace" (priorité de position sur la carte au minimum,
-- autres avantages à définir plus tard). Remplace ENTIÈREMENT le
-- placeholder d'abonnement générique "2 000 FCFA/mois" construit plus tôt
-- sur /premium (tables transactions/subscriptions, par UTILISATEUR) —
-- décision explicite : ce concept est abandonné, /premium devient
-- exclusivement ce flux jetons, par BOUTIQUE. La table "transactions" et
-- "subscriptions" restent en base (utilisées par KPay/confection de CV),
-- seulement leur usage "premium" via Orange Money est retiré côté route.
--
-- Taux de change (coût d'un jeton en FCFA, jetons requis pour 1 an de
-- Premium) : AUCUNE valeur n'a été fixée à ce jour (demande explicite : ne
-- jamais coder ces chiffres en dur). Stockés dans jetons_config, table à
-- une seule ligne, modifiable par simple UPDATE SQL — aucun redéploiement
-- requis pour ajuster ces chiffres une fois décidés. Les valeurs insérées
-- ci-dessous (100 FCFA/jeton, 50 jetons/an = 5 000 FCFA/an) sont des
-- PLACEHOLDERS explicites pour que le flux soit testable de bout en bout
-- avant que les vrais chiffres ne soient tranchés — jamais présentés comme
-- définitifs côté UI (voir PremiumClient.jsx).

-- ---------------------------------------------------------------------------
-- 1. Configuration du taux de change (une seule ligne, singleton)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jetons_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cout_jeton_fcfa INTEGER NOT NULL CHECK (cout_jeton_fcfa > 0),
  jetons_requis_premium_an INTEGER NOT NULL CHECK (jetons_requis_premium_an > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.jetons_config (id, cout_jeton_fcfa, jetons_requis_premium_an)
VALUES (1, 100, 50)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.jetons_config ENABLE ROW LEVEL SECURITY;

-- Lecture publique : la page /premium affiche le taux avant même de savoir
-- quelle boutique achète (utilisateur non connecté compris, cohérent avec
-- les prix déjà publics ailleurs sur le site).
DROP POLICY IF EXISTS "Le taux de change des jetons est public" ON public.jetons_config;
CREATE POLICY "Le taux de change des jetons est public" ON public.jetons_config
  FOR SELECT USING (true);

-- Aucun GRANT INSERT/UPDATE/DELETE à qui que ce soit : ajusté uniquement
-- par une requête SQL directe (voir tests/helpers/privilegedSql.js) tant
-- qu'aucun écran admin dédié n'existe — hors périmètre de ce point.
GRANT SELECT ON public.jetons_config TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Solde de jetons par boutique
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jetons_boutique (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL UNIQUE REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  solde_jetons INTEGER NOT NULL DEFAULT 0 CHECK (solde_jetons >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jetons_boutique_store ON public.jetons_boutique(store_id);

ALTER TABLE public.jetons_boutique ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Un vendeur lit le solde de sa boutique" ON public.jetons_boutique;
CREATE POLICY "Un vendeur lit le solde de sa boutique" ON public.jetons_boutique
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.marketplace_stores s WHERE s.id = jetons_boutique.store_id AND s.owner_id = auth.uid())
  );

-- Aucun GRANT INSERT/UPDATE/DELETE à authenticated/anon : le solde n'est
-- jamais modifié directement par le client — seulement par
-- crediter_jetons_boutique() (webhook de paiement) et
-- activer_premium_marketplace() (dépense), toutes deux SECURITY DEFINER
-- plus bas.
GRANT SELECT ON public.jetons_boutique TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Historique des mouvements de jetons
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jetons_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  montant INTEGER NOT NULL, -- positif = achat, négatif = dépense (jamais 0)
  type TEXT NOT NULL CHECK (type IN ('achat', 'activation_premium')),
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('pending', 'success', 'failed')),
  -- qrId/transactionId Orange Money — uniquement renseigné pour type='achat'.
  provider_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (montant <> 0),
  CHECK ((type = 'achat' AND montant > 0) OR (type = 'activation_premium' AND montant < 0))
);

CREATE INDEX IF NOT EXISTS idx_jetons_transactions_store ON public.jetons_transactions(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jetons_transactions_provider_ref ON public.jetons_transactions(provider_reference);

ALTER TABLE public.jetons_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Un vendeur lit l historique de sa boutique" ON public.jetons_transactions;
CREATE POLICY "Un vendeur lit l historique de sa boutique" ON public.jetons_transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.marketplace_stores s WHERE s.id = jetons_transactions.store_id AND s.owner_id = auth.uid())
  );

-- Initiation d'un achat (ligne "pending", avant tout paiement réel) — même
-- schéma que "transactions" (src/app/api/pay/checkout/route.js) : le
-- client authentifié crée la ligne pending, seul le webhook (service_role)
-- la fait ensuite passer à success/failed. "activation_premium" n'est
-- JAMAIS inséré par le client : uniquement par activer_premium_marketplace
-- (SECURITY DEFINER, plus bas) — WITH CHECK ci-dessous le rend impossible
-- à contourner en insérant directement le type dépense sans passer par le
-- solde vérifié côté serveur.
DROP POLICY IF EXISTS "Un vendeur initie un achat de jetons pour sa boutique" ON public.jetons_transactions;
CREATE POLICY "Un vendeur initie un achat de jetons pour sa boutique" ON public.jetons_transactions
  FOR INSERT WITH CHECK (
    type = 'achat' AND status = 'pending'
    AND EXISTS (SELECT 1 FROM public.marketplace_stores s WHERE s.id = jetons_transactions.store_id AND s.owner_id = auth.uid())
  );

-- Référence de paiement posée juste après l'insertion initiale (même
-- lacune déjà corrigée sur "transactions" par une policy UPDATE dédiée,
-- voir 20260911150000_marketplace_subscriptions.sql) : GRANT colonne +
-- policy RLS nécessaires ensemble, sans quoi PostgREST rejette
-- silencieusement toute tentative même sur une colonne autorisée par le
-- GRANT.
GRANT UPDATE (provider_reference) ON public.jetons_transactions TO authenticated;
DROP POLICY IF EXISTS "Un vendeur met a jour la reference de paiement de sa transaction" ON public.jetons_transactions;
CREATE POLICY "Un vendeur met a jour la reference de paiement de sa transaction" ON public.jetons_transactions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.marketplace_stores s WHERE s.id = jetons_transactions.store_id AND s.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.marketplace_stores s WHERE s.id = jetons_transactions.store_id AND s.owner_id = auth.uid())
  );

GRANT SELECT, INSERT ON public.jetons_transactions TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Journal d'audit append-only des webhooks Orange Money "jetons" —
--    même patron que orange_money_webhook_events (20260911120000), table
--    séparée plutôt que réutilisée : ce journal-ci porte sur des achats de
--    jetons (store_id), l'autre sur l'ancien abonnement générique
--    (user_id) qui n'est plus alimenté après ce point mais reste en base
--    pour l'historique.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jetons_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT,
  orange_transaction_id TEXT,
  reference TEXT,
  jetons_transaction_id UUID REFERENCES public.jetons_transactions(id),
  raw_payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jetons_webhook_events_transaction_id ON public.jetons_webhook_events(jetons_transaction_id);
CREATE INDEX IF NOT EXISTS idx_jetons_webhook_events_received_at ON public.jetons_webhook_events(received_at DESC);

ALTER TABLE public.jetons_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Seuls les admins lisent les evenements webhook jetons" ON public.jetons_webhook_events;
CREATE POLICY "Seuls les admins lisent les evenements webhook jetons" ON public.jetons_webhook_events
  FOR SELECT USING (public.is_admin(auth.uid()));

GRANT SELECT ON public.jetons_webhook_events TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Périodes Premium Marketplace (historique — plusieurs lignes possibles
--    dans le temps, jamais deux périodes actives en même temps pour une
--    même boutique, contrôlé par activer_premium_marketplace ci-dessous :
--    impossible à exprimer en contrainte déclarative, date_expiration >
--    now() n'étant pas IMMUTABLE — l'exclusion se fait donc en code
--    plutôt qu'en contrainte).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.premium_marketplace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  date_activation TIMESTAMPTZ NOT NULL DEFAULT now(),
  date_expiration TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_premium_marketplace_store ON public.premium_marketplace(store_id);
-- Index partiel impossible avec now() (non IMMUTABLE) : un index simple sur
-- date_expiration suffit pour les requêtes "actif maintenant" (WHERE
-- date_expiration > now()), qui restent des scans d'index classiques.
CREATE INDEX IF NOT EXISTS idx_premium_marketplace_expiration ON public.premium_marketplace(date_expiration);

ALTER TABLE public.premium_marketplace ENABLE ROW LEVEL SECURITY;

-- Visible publiquement (pas seulement du propriétaire) : la mise en avant
-- sur la carte/recherche (Point 6) doit savoir, pour N'IMPORTE QUELLE
-- boutique affichée, si elle est Premium — sans ça, chaque acheteur
-- déclencherait une lecture refusée en silence et verrait toutes les
-- boutiques comme non-Premium.
DROP POLICY IF EXISTS "Le statut premium est visible de tous" ON public.premium_marketplace;
CREATE POLICY "Le statut premium est visible de tous" ON public.premium_marketplace
  FOR SELECT USING (true);

-- Aucun GRANT INSERT/UPDATE/DELETE : uniquement écrit par
-- activer_premium_marketplace (SECURITY DEFINER).
GRANT SELECT ON public.premium_marketplace TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. crediter_jetons_boutique — appelée par le webhook Orange Money
--    (service_role, contourne RLS) à la confirmation d'un achat. Jamais
--    appelable par un client authentifié : GRANT EXECUTE à personne,
--    seul service_role (propriétaire de la connexion admin) peut
--    l'exécuter — cohérent avec l'écriture directe déjà faite par
--    kpay-webhook/orange-money-webhook sur "transactions"/"subscriptions"
--    (pas de fonction dédiée là-bas, mais ici le solde a une contrainte
--    CHECK >= 0 à respecter atomiquement, d'où la fonction).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crediter_jetons_boutique(p_store_id UUID, p_montant INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_solde INTEGER;
BEGIN
  IF p_montant <= 0 THEN
    RAISE EXCEPTION 'Le montant à créditer doit être positif.';
  END IF;

  INSERT INTO public.jetons_boutique (store_id, solde_jetons)
  VALUES (p_store_id, p_montant)
  ON CONFLICT (store_id) DO UPDATE
    SET solde_jetons = public.jetons_boutique.solde_jetons + EXCLUDED.solde_jetons,
        updated_at = now()
  RETURNING solde_jetons INTO v_solde;

  RETURN v_solde;
END;
$$;

REVOKE ALL ON FUNCTION public.crediter_jetons_boutique(UUID, INTEGER) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. activer_premium_marketplace — dépense de jetons + activation, en une
--    seule transaction atomique (le corps de fonction EST la transaction) :
--    déduction du solde, journal de la dépense, et création de la période
--    Premium ne peuvent jamais se retrouver dans un état intermédiaire
--    incohérent.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activer_premium_marketplace(p_store_id UUID)
RETURNS public.premium_marketplace
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner UUID;
  v_periode_active UUID;
  v_cout INTEGER;
  v_nouveau_solde INTEGER;
  v_row public.premium_marketplace;
BEGIN
  SELECT owner_id INTO v_owner FROM public.marketplace_stores WHERE id = p_store_id;
  IF v_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez activer Premium que pour votre propre boutique.';
  END IF;

  SELECT id INTO v_periode_active
  FROM public.premium_marketplace
  WHERE store_id = p_store_id AND date_expiration > now()
  LIMIT 1;

  IF v_periode_active IS NOT NULL THEN
    RAISE EXCEPTION 'Cette boutique a déjà une période Premium Marketplace active. Attendez son expiration avant de réactiver.';
  END IF;

  SELECT jetons_requis_premium_an INTO v_cout FROM public.jetons_config WHERE id = 1;
  IF v_cout IS NULL THEN
    RAISE EXCEPTION 'Le tarif Premium Marketplace n''est pas configuré.';
  END IF;

  UPDATE public.jetons_boutique
  SET solde_jetons = solde_jetons - v_cout, updated_at = now()
  WHERE store_id = p_store_id AND solde_jetons >= v_cout
  RETURNING solde_jetons INTO v_nouveau_solde;

  IF v_nouveau_solde IS NULL THEN
    RAISE EXCEPTION 'Solde de jetons insuffisant (% jetons requis).', v_cout;
  END IF;

  INSERT INTO public.jetons_transactions (store_id, montant, type, status)
  VALUES (p_store_id, -v_cout, 'activation_premium', 'success');

  INSERT INTO public.premium_marketplace (store_id, date_activation, date_expiration)
  VALUES (p_store_id, now(), now() + interval '1 year')
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.activer_premium_marketplace(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activer_premium_marketplace(UUID) TO authenticated;
