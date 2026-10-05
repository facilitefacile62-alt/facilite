-- Interrupteur admin pour le circuit livreur (Point 5/12), même esprit que
-- 20260831160000_feature_flag_marketplace.sql : permet de couper l'accès au
-- formulaire "Devenir livreur" depuis /admin sans déploiement, pendant le
-- rollout progressif de la fonctionnalité.

INSERT INTO public.feature_flags (id, branch_id, name, path, enabled, roles, updated_at)
VALUES (
  'nav_marketplace_livreur',
  'branch_nav',
  'Marketplace — Devenir livreur',
  '/marketplace?onglet=livrer',
  true,
  '{"user": true, "recruiter": true, "visitor": false}'::jsonb,
  now()
)
ON CONFLICT (id) DO NOTHING;
