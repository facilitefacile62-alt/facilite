-- Interrupteur « connexion et inscription par téléphone (SMS) » : feat_connexion_telephone.
-- FERMÉ par défaut. Le site (login, register) et l'application (connexion, inscription) ne proposent le téléphone que si cette ligne est lue ET ouverte ; fermé, ils
-- ne montrent que « Continuer avec Google » et l'e-mail, et l'onglet par défaut n'est plus « Téléphone ». Ligne absente ou illisible : fermé (côté clients).
-- La table feature_flags est lisible sans connexion (policy « Lecture publique des indicateurs de fonctionnalites » + droit SELECT pour anon) ; seul un administrateur la modifie.
-- Additif : une seule ligne. Retour arrière : docs/rollbacks/20261025220000_interrupteur_connexion_telephone.down.sql.
INSERT INTO public.feature_flags (id, branch_id, name, path, enabled, roles)
VALUES ('feat_connexion_telephone', 'branch_candidat', 'Connexion et inscription par téléphone (SMS)', NULL, FALSE, '{"user": true, "visitor": true, "recruiter": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;
