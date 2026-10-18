-- Stories de départ du fil d'actualité (site et application).
--
-- La table stories était vide : le fil n'affichait donc aucune rangée de stories (l'application ne propose plus le
-- repli « modèles de CV », qui ouvrait le créateur de CV). Deux stories sont créées à partir de visuels RÉELS déjà
-- publiés sur le site :
--   - « CV Professionnel » : l'affiche des services et tarifs de confection de CV (WhatsApp Facilité) ;
--   - « Offre Comptable » : l'avis de recrutement d'un comptable (Ageroute, 31/08/2026).
-- Les autres stories prévues par la maquette (CV Moderne, Offre Développeur, CV Étudiant) ne sont PAS inventées : elles
-- s'ajoutent depuis Administration → Stories avec leurs vrais visuels. Le bouton « Commander via WhatsApp » n'a pas de
-- lien propre : l'application ouvre alors le WhatsApp de Facilité avec le nom de la story dans le message.
-- Idempotent : une story du même titre n'est jamais créée deux fois.

INSERT INTO public.stories (titre, image_url, libelle_bouton, lien, ordre, actif)
SELECT 'CV Professionnel', 'https://ffacilite.com/affiche_cv_pro.jpg', 'Commander via WhatsApp', NULL, 1, true
WHERE NOT EXISTS (SELECT 1 FROM public.stories WHERE titre = 'CV Professionnel');

INSERT INTO public.stories (titre, image_url, libelle_bouton, lien, ordre, actif)
SELECT 'Offre Comptable', 'https://ffacilite.com/ageroute_recrutement_comptable_pcza.jpg', 'Commander via WhatsApp', NULL, 2, true
WHERE NOT EXISTS (SELECT 1 FROM public.stories WHERE titre = 'Offre Comptable');
