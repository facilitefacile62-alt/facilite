-- Branche le vrai paiement Orange Money sur formation_redaction_cv_inscriptions
-- — point demandé explicitement après 20260925140000 ("Une fois payé,
-- l'inscription est créée dans la table déjà existante... réutilise le même
-- composant/flux déjà en place pour les abonnements premium").
--
-- Correction importante découverte en creusant avant d'écrire cette
-- migration : le flux "générique" que 20260925140000 croyait réutilisable
-- (table transactions + webhook orange-money-webhook, cités par les
-- migrations 20260801200000/20260911120000) est en réalité ABANDONNÉ —
-- confirmé par le commentaire de tête de jetons-webhook/route.js
-- ("structure identique à l'ancien orange-money-webhook, abandonné") et par
-- checkout/route.js qui renvoie désormais une erreur dure pour ce flux
-- (retiré le 2026-08-28 : contenu numérique consommé dans l'app, imposerait
-- Google Play Billing, cf. son commentaire de tête). Le SEUL flux Orange
-- Money vivant aujourd'hui est celui des "jetons" Marketplace
-- (jetons-checkout/jetons-webhook, table jetons_transactions) — c'est CE
-- patron qui est reproduit ici, PAS l'ancien.
--
-- Conséquence directe de ce même constat (contenu numérique + accès
-- possible depuis l'app Android) : la formation est logée sur une page WEB
-- SEULEMENT (jamais ajoutée à mobile/src/lib/webEcrans.ts), même mitigation
-- déjà en place pour /premium (voir son commentaire de tête, PremiumClient.jsx).
--
-- transaction_id (référence à la table "transactions" abandonnée,
-- 20260925140000) est retiré : sans écriture réelle possible dessus, il
-- n'aurait jamais servi à rien. provider_reference (le qrId Orange Money)
-- le remplace, porté directement par la ligne d'inscription elle-même —
-- contrairement aux jetons (rechargeables, un historique de transactions a
-- du sens), cette formation s'achète une seule fois par utilisateur
-- (user_id déjà UNIQUE) : la ligne d'inscription EST la transaction, pas
-- besoin d'une table séparée.

ALTER TABLE public.formation_redaction_cv_inscriptions
  DROP COLUMN IF EXISTS transaction_id,
  ADD COLUMN IF NOT EXISTS provider_reference TEXT;

CREATE INDEX IF NOT EXISTS idx_formation_redaction_cv_inscriptions_provider_ref
  ON public.formation_redaction_cv_inscriptions(provider_reference);

-- Initiation du paiement (ligne "pending", avant tout paiement réel) — même
-- principe que "Un vendeur initie un achat de jetons pour sa boutique"
-- (20260912020000) : le client authentifié crée sa propre ligne pending,
-- seul le webhook (service_role) la fait ensuite passer à paye=true.
DROP POLICY IF EXISTS "Un utilisateur initie son inscription formation CV" ON public.formation_redaction_cv_inscriptions;
CREATE POLICY "Un utilisateur initie son inscription formation CV" ON public.formation_redaction_cv_inscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id AND paye = false AND certifie = false);

-- Référence de paiement (qrId) posée juste après l'insertion initiale —
-- même lacune que jetons_transactions/provider_reference : GRANT colonne +
-- policy RLS nécessaires ensemble (PostgREST rejette sinon silencieusement).
GRANT UPDATE (provider_reference) ON public.formation_redaction_cv_inscriptions TO authenticated;
DROP POLICY IF EXISTS "Un utilisateur pose la reference de paiement de sa formation CV" ON public.formation_redaction_cv_inscriptions;
CREATE POLICY "Un utilisateur pose la reference de paiement de sa formation CV" ON public.formation_redaction_cv_inscriptions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT INSERT ON public.formation_redaction_cv_inscriptions TO authenticated;

-- Journal d'audit append-only des webhooks (idempotence + traçabilité),
-- même patron que jetons_webhook_events/orange_money_webhook_events —
-- table séparée par produit, jamais réutilisée entre eux.
CREATE TABLE public.formation_redaction_cv_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT,
  orange_transaction_id TEXT,
  reference TEXT,
  inscription_id UUID REFERENCES public.formation_redaction_cv_inscriptions(id),
  raw_payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_formation_redaction_cv_webhook_events_inscription_id
  ON public.formation_redaction_cv_webhook_events(inscription_id);
CREATE INDEX IF NOT EXISTS idx_formation_redaction_cv_webhook_events_received_at
  ON public.formation_redaction_cv_webhook_events(received_at DESC);

ALTER TABLE public.formation_redaction_cv_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Seuls les admins lisent les evenements webhook formation CV" ON public.formation_redaction_cv_webhook_events
  FOR SELECT USING (public.is_admin(auth.uid()));

GRANT SELECT ON public.formation_redaction_cv_webhook_events TO authenticated;
