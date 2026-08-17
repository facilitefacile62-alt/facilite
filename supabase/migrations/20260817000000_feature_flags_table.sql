-- Migration 20260817000000_feature_flags_table.sql
--
-- Rend réel le panneau admin "Fonctionnalités" (/admin) : jusqu'ici,
-- getFeatureFlagsTree()/saveFeatureFlagsTree() (src/lib/featureFlags.js)
-- lisaient/écrivaient localStorage — un interrupteur PAR NAVIGATEUR, sans
-- aucun effet pour les autres visiteurs/utilisateurs. Cette table devient la
-- source commune, lue par le middleware (src/proxy.js, navigation directe)
-- et par Header.jsx (clic sur un lien du menu).
--
-- DEFAULT_FEATURE_TREE (src/lib/featureFlags.js) reste la source des
-- métadonnées d'affichage (icônes, descriptions, regroupement par branche) —
-- cette table ne stocke QUE l'état modifiable (enabled/roles) plus une copie
-- de path/name/branch_id utilisée pour la requête middleware autonome et
-- l'audit SQL. Si un chemin change dans featureFlags.js, la ligne
-- correspondante ici doit être mise à jour par une migration de suivi.

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  name TEXT NOT NULL,
  path TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  roles JSONB NOT NULL DEFAULT '{"user":true,"recruiter":true,"visitor":true}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Table fraîchement créée : aucun droit hérité pour anon/authenticated
-- (20260807130000_fix_default_privileges_public_schema.sql) — chaque GRANT
-- ci-dessous est donc explicitement nécessaire, pas défensif.
GRANT SELECT ON public.feature_flags TO anon, authenticated;

DROP POLICY IF EXISTS "Lecture publique des indicateurs de fonctionnalites" ON public.feature_flags;
CREATE POLICY "Lecture publique des indicateurs de fonctionnalites" ON public.feature_flags
  FOR SELECT
  TO public
  USING (true);

-- Écriture admin uniquement, via current_user_role() (jamais une sous-
-- requête brute sur user_roles dans une policy : risque de récursion RLS,
-- voir 20260802050000_rbac_user_roles.sql). GRANT scopé aux colonnes
-- modifiables (enabled/roles/updated_at, jamais id/branch_id/name/path) —
-- même idiome que public.reports (20260803040000_moderation_et_suspension.sql).
DROP POLICY IF EXISTS "Un admin modifie les indicateurs de fonctionnalites" ON public.feature_flags;
CREATE POLICY "Un admin modifie les indicateurs de fonctionnalites" ON public.feature_flags
  FOR UPDATE
  USING (public.current_user_role() = 'admin');
GRANT UPDATE (enabled, roles, updated_at) ON public.feature_flags TO authenticated;

-- Propagation en direct des bascules admin vers les onglets déjà ouverts
-- d'autres utilisateurs (Header.jsx, Phase C) — même mécanisme que
-- job_offers (src/app/offres/page.js).
ALTER PUBLICATION supabase_realtime ADD TABLE public.feature_flags;

-- Seed idempotent — copie exacte des 23 entrées de DEFAULT_FEATURE_TREE,
-- toutes enabled=true (état actuel réel), roles copiés tels quels (5 lignes
-- non-uniformes : feat_candidat_dashboard, feat_publier_offre,
-- feat_recruteur_dashboard, feat_recruteur_cvtheque, feat_demande_badge —
-- les seeder toutes à roles par défaut serait une régression de
-- comportement dès le premier jour).
--
-- nav_extracteur.path : corrigé ici (et dans featureFlags.js, Phase B) de
-- "/importer-cv" vers "/candidat/extracteur" — son vrai lien dans
-- Header.jsx pointe vers /candidat/extracteur (page distincte de
-- /importer-cv), erreur de métadonnée pré-existante corrigée en même temps.
INSERT INTO public.feature_flags (id, branch_id, name, path, enabled, roles) VALUES
  ('nav_home', 'branch_nav', 'Page d''Accueil', '/', true, '{"user":true,"recruiter":true,"visitor":true}'::jsonb),
  ('nav_offres', 'branch_nav', 'Offres d''emploi', '/offres', true, '{"user":true,"recruiter":true,"visitor":true}'::jsonb),
  ('nav_extracteur', 'branch_nav', 'Extracteur / Importer CV', '/candidat/extracteur', true, '{"user":true,"recruiter":true,"visitor":true}'::jsonb),
  ('nav_messagerie', 'branch_nav', 'Messagerie Echanges', '/messagerie', true, '{"user":true,"recruiter":true,"visitor":true}'::jsonb),
  ('nav_plus_importer', 'branch_nav', 'Importer CV (Analyse IA et recommandations)', '/importer-cv', true, '{"user":true,"recruiter":true,"visitor":true}'::jsonb),
  ('nav_plus_fonctionnalites', 'branch_nav', 'Fonctionnalites (Outils IA, Modeles & Recrutement)', '/service', true, '{"user":true,"recruiter":true,"visitor":true}'::jsonb),
  ('nav_plus_service', 'branch_nav', 'Services & Modeles (CVs Pro, Canada, Anglais & Lettres)', '/service', true, '{"user":true,"recruiter":true,"visitor":true}'::jsonb),
  ('nav_plus_recrutement_spontane', 'branch_nav', 'Recrutement Spontane (Repertoire des 77 entreprises)', '/recrutement-spontane', true, '{"user":true,"recruiter":true,"visitor":true}'::jsonb),
  ('nav_plus_depots', 'branch_nav', 'Depots Physiques (Stations-services & contacts)', '/recrutement-journalier', true, '{"user":true,"recruiter":true,"visitor":true}'::jsonb),
  ('nav_plus_concours', 'branch_nav', 'Concours (Avis & examens de la fonction publique)', '/offres?q=Concours', true, '{"user":true,"recruiter":true,"visitor":true}'::jsonb),
  ('nav_plus_formation', 'branch_nav', 'Formation (Certifications & cours pro)', '/offres?q=Formation', true, '{"user":true,"recruiter":true,"visitor":true}'::jsonb),
  ('nav_plus_boite_idees', 'branch_nav', 'Boite a idees (Suggestions & Innovation)', '/boite-a-idees', true, '{"user":true,"recruiter":true,"visitor":true}'::jsonb),
  ('feat_creer_cv', 'branch_candidat', 'Createur de CV & Studio Canva', '/creer-cv', true, '{"user":true,"recruiter":true,"visitor":true}'::jsonb),
  ('feat_modeles_cv', 'branch_candidat', 'Catalogue Modeles 360', '/modeles', true, '{"user":true,"recruiter":true,"visitor":true}'::jsonb),
  ('feat_importer_cv', 'branch_candidat', 'Analyseur & Scanner IA de CV', '/importer-cv', true, '{"user":true,"recruiter":true,"visitor":true}'::jsonb),
  ('feat_simulation_entretien', 'branch_candidat', 'Simulation d''Entretien IA', '/simulation-entretien', true, '{"user":true,"recruiter":true,"visitor":true}'::jsonb),
  ('feat_candidat_dashboard', 'branch_candidat', 'Espace Candidat (Mes CVs / Candidatures)', '/candidat/mes-cvs', true, '{"user":true,"recruiter":false,"visitor":false}'::jsonb),
  ('feat_publier_offre', 'branch_recruteur', 'Publication d''Offre d''Emploi', '/publier-offre', true, '{"user":false,"recruiter":true,"visitor":false}'::jsonb),
  ('feat_recruteur_dashboard', 'branch_recruteur', 'Tableau de Bord Recruteur', '/recruteur-dashboard', true, '{"user":false,"recruiter":true,"visitor":false}'::jsonb),
  ('feat_recruteur_cvtheque', 'branch_recruteur', 'CVtheque & Recherche Candidats', '/recruteur', true, '{"user":false,"recruiter":true,"visitor":false}'::jsonb),
  ('feat_demande_badge', 'branch_recruteur', 'Demande de Badge Verifie', '/demande-badge', true, '{"user":true,"recruiter":true,"visitor":false}'::jsonb),
  ('feat_commandes_agent', 'branch_services', 'Commandes & Accompagnement Agent', '/commandes-agent', true, '{"user":true,"recruiter":true,"visitor":true}'::jsonb),
  ('feat_service_tarifs', 'branch_services', 'Grille Tarifaire & Abonnements', '/service', true, '{"user":true,"recruiter":true,"visitor":true}'::jsonb)
ON CONFLICT (id) DO NOTHING;
