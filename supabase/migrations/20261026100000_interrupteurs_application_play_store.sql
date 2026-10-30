-- Onze interrupteurs, tous FERMÉS, propres à l'APPLICATION, pour la première version Android sur le Play Store (décisions du propriétaire du 26/10/2026).
-- On MASQUE seulement : rien n'est supprimé. L'application lit cette table sans connexion (policy « Lecture publique des indicateurs de fonctionnalites ») ; un
-- interrupteur absent ou illisible reste FERMÉ (valeur par défaut écrite dans le code de l'application). Les rouvrir ne demande aucune nouvelle version : un
-- administrateur ouvre la ligne. Un administrateur voit toujours tout dans l'application. Le site n'est pas concerné : ces lignes ne sont lues que par l'application
-- (les interrupteurs partagés avec le site, comme nav_extracteur ou nav_plus_fonctionnalites, ne sont pas touchés).
--   feat_paiements_application             paiements : jetons, Premium de Locaux, formation, achat de CV, facturation (Android ET iPhone)
--   feat_scanner_document                  scanner de documents et lecture de pièce d'identité (intelligence artificielle payante)
--   feat_app_extracteur                    Extracteur (bouton flottant, écran, entrée de la liste)
--   feat_app_fonctionnalites               écran « Fonctionnalités » (onglet du profil, tuile du menu, écran, outils PDF)
--   feat_app_diagnostic_cv                 Diagnostic CV (tuile du menu, entrée de la liste)
--   feat_app_boite_idees                   Boîte à idées (tuile du menu, entrée de la liste)
--   feat_app_creer_cv                      Création de CV (page du site ouverte dans l'application)
--   feat_app_modeles_cv                    Modèles de CV et « Studio Services & Modèles » (page du site ouverte dans l'application)
--   feat_app_inscription                   inscription dans l'application (e-mail ou téléphone)
--   feat_app_mot_de_passe_oublie           « Mot de passe oublié » dans l'application (la réinitialisation se fait sur le site)
--   feat_app_connexion_sans_mot_de_passe   connexion par code ou lien magique envoyé par e-mail
-- Additif : onze lignes, rien d'autre. Retour arrière : docs/rollbacks/20261026100000_interrupteurs_application_play_store.down.sql.
INSERT INTO public.feature_flags (id, branch_id, name, path, enabled, roles)
VALUES
  ('feat_paiements_application', 'branch_candidat', 'Application : paiements (jetons, Premium, formation, achat de CV, facturation)', NULL, FALSE, '{"user": true, "visitor": true, "recruiter": true}'::jsonb),
  ('feat_scanner_document', 'branch_candidat', 'Application : scanner de documents et pièce d''identité (IA)', NULL, FALSE, '{"user": true, "visitor": true, "recruiter": true}'::jsonb),
  ('feat_app_extracteur', 'branch_candidat', 'Application : Extracteur', NULL, FALSE, '{"user": true, "visitor": true, "recruiter": true}'::jsonb),
  ('feat_app_fonctionnalites', 'branch_candidat', 'Application : écran Fonctionnalités', NULL, FALSE, '{"user": true, "visitor": true, "recruiter": true}'::jsonb),
  ('feat_app_diagnostic_cv', 'branch_candidat', 'Application : Diagnostic CV', NULL, FALSE, '{"user": true, "visitor": true, "recruiter": true}'::jsonb),
  ('feat_app_boite_idees', 'branch_candidat', 'Application : Boîte à idées', NULL, FALSE, '{"user": true, "visitor": true, "recruiter": true}'::jsonb),
  ('feat_app_creer_cv', 'branch_candidat', 'Application : Création de CV', NULL, FALSE, '{"user": true, "visitor": true, "recruiter": true}'::jsonb),
  ('feat_app_modeles_cv', 'branch_candidat', 'Application : Modèles de CV et Studio Services & Modèles', NULL, FALSE, '{"user": true, "visitor": true, "recruiter": true}'::jsonb),
  ('feat_app_inscription', 'branch_candidat', 'Application : inscription', NULL, FALSE, '{"user": true, "visitor": true, "recruiter": true}'::jsonb),
  ('feat_app_mot_de_passe_oublie', 'branch_candidat', 'Application : mot de passe oublié', NULL, FALSE, '{"user": true, "visitor": true, "recruiter": true}'::jsonb),
  ('feat_app_connexion_sans_mot_de_passe', 'branch_candidat', 'Application : connexion par code ou lien magique par e-mail', NULL, FALSE, '{"user": true, "visitor": true, "recruiter": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;
