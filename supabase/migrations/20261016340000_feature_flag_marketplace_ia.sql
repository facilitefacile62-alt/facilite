-- Interrupteur admin « IA » de la Marketplace : MIS EN PAUSE.
--
-- Les fonctions IA de la Marketplace (recherche par photo dans l'en-tête et sur la carte, « Scanner le
-- produit avec l'IA » et « Optimiser texte SEO » à la publication) dépendent de l'abonnement à l'API
-- d'analyse d'images, dont les crédits sont épuisés (erreur 402 constatée le 16/10/2026). Tant que
-- l'interrupteur est coupé, ces boutons sont grisés pour tout le monde sauf l'administrateur, et les
-- routes serveur refusent les appels (aucune dépense, aucun faux résultat).
-- Pour rouvrir, une fois l'abonnement réglé : Administration → Fonctionnalités →
-- « Marketplace — Fonctions IA (photo, optimisation) » → activer. Même patron que
-- nav_marketplace_voyages ; ON CONFLICT DO NOTHING : un choix déjà fait par l'administrateur est conservé.
INSERT INTO public.feature_flags (id, branch_id, name, path, enabled, roles, updated_at)
VALUES (
  'feat_marketplace_ia',
  'branch_services',
  'Marketplace — Fonctions IA (photo, optimisation)',
  NULL,
  false,
  '{"user": true, "recruiter": true, "visitor": true}'::jsonb,
  now()
)
ON CONFLICT (id) DO NOTHING;
