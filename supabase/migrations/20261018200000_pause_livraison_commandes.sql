-- Mise en pause, pour le public, de la livraison et des commandes du Marketplace.
--
-- Décision du propriétaire (18/10/2026) : « Devenir livreur », « Trouver un livreur », les commandes et les
-- livraisons sont gardés pour la mise à jour suivante. Pour le moment le public ne garde que la DISCUSSION
-- (messagerie, WhatsApp) avec les vendeurs.
--  - nav_marketplace_livreur : coupé (il était ouvert à tous depuis 20261018160000). Couvre « Devenir livreur »,
--    « Trouver un livreur » et les écrans de livraison.
--  - feat_marketplace_commandes (nouveau) : coupé. Couvre « Commander », « Mes commandes » (acheteur et vendeur).
-- L'administrateur garde l'accès pour tester ; réactivation : Administration → Fonctionnalités.

UPDATE public.feature_flags
SET enabled = false, updated_at = now()
WHERE id = 'nav_marketplace_livreur';

INSERT INTO public.feature_flags (id, branch_id, name, path, enabled, roles, updated_at)
VALUES (
  'feat_marketplace_commandes',
  'branch_services',
  'Marketplace — Commandes et livraisons',
  NULL,
  false,
  '{"user": true, "recruiter": true, "visitor": true}'::jsonb,
  now()
)
ON CONFLICT (id) DO NOTHING;
