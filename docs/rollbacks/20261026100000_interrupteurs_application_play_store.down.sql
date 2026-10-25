-- Annulation de 20261026100000_interrupteurs_application_play_store.sql (à passer par un fichier, jamais dans l'éditeur du dashboard).
-- Supprime les onze lignes : sans elles, l'application considère ces fonctions FERMÉES (comportement par défaut du code).
DELETE FROM public.feature_flags
 WHERE id IN (
   'feat_paiements_application', 'feat_scanner_document', 'feat_app_extracteur', 'feat_app_fonctionnalites', 'feat_app_diagnostic_cv', 'feat_app_boite_idees',
   'feat_app_creer_cv', 'feat_app_modeles_cv', 'feat_app_inscription', 'feat_app_mot_de_passe_oublie', 'feat_app_connexion_sans_mot_de_passe'
 );
