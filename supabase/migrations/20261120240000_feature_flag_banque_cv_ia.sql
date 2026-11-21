-- Interrupteur admin « IA » de la Banque de CV : FERMÉ par défaut.
--
-- Contexte : l'import groupé du 30/09/2026 (771 CV) a épuisé les crédits Gemini (HTTP 402) ; 694 CV sont restés
-- sans analyse. Tant que l'interrupteur est coupé, AUCUN appel à l'IA n'est fait par la Banque de CV, pour personne,
-- administrateur compris (c'est l'administrateur qui importe : le laisser passer ne protégerait rien) :
--   - l'import enregistre le fichier et le texte lisible sans OCR, en statut « nouveau » (en attente d'analyse) ;
--   - l'import d'une photo ou d'un PDF scanné est refusé avec un message clair (sa lecture passe par l'IA) ;
--   - « Trouver le candidat idéal » est refusé avec un message clair (embedding + diagnostic passent par l'IA).
-- Pour rouvrir, une fois les crédits rechargés : Administration → Fonctionnalités →
-- « Banque de CV — Analyse IA (import, recherche) » → activer.
-- Même patron que feat_marketplace_ia ; ON CONFLICT DO NOTHING : un choix déjà fait par l'administrateur est conservé.
-- Insertion seule : aucun interrupteur existant n'est modifié.
INSERT INTO public.feature_flags (id, branch_id, name, path, enabled, roles, updated_at)
VALUES (
  'feat_banque_cv_ia',
  'branch_services',
  'Banque de CV — Analyse IA (import, recherche)',
  NULL,
  false,
  '{"user": false, "recruiter": false, "visitor": false}'::jsonb,
  now()
)
ON CONFLICT (id) DO NOTHING;
