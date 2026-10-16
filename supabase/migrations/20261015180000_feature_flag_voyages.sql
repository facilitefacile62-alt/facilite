-- Interrupteur admin « Voyages » (transport de passagers) : MIS EN PAUSE.
-- Les voyages (chauffeurs validés, réservations, suivi en direct) sont construits
-- (20261015160000) mais on se concentre d'abord sur la livraison. Tant que ce
-- drapeau est coupé, personne ne voit les boutons « Voyages » ni « Devenir chauffeur »
-- dans la Marketplace ; l'administrateur, lui, garde toujours l'accès pour tester
-- (voir isFeatureAllowed). Pour rouvrir : Administration → Fonctionnalités →
-- « Marketplace — Voyages » → activer. Même patron que nav_marketplace_livreur.
INSERT INTO public.feature_flags (id, branch_id, name, path, enabled, roles, updated_at)
VALUES (
  'nav_marketplace_voyages',
  'branch_nav',
  'Marketplace — Voyages (transport de passagers)',
  '/marketplace?voyages=1',
  false,
  '{"user": true, "recruiter": true, "visitor": false}'::jsonb,
  now()
)
ON CONFLICT (id) DO NOTHING;
