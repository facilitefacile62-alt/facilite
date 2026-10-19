-- Les cinq stories de la maquette « Stories », dans son ordre :
--   1. CV Moderne  2. Offre Comptable  3. CV Professionnel  4. Offre Développeur  5. CV Étudiant
--
-- - CV Moderne et CV Étudiant : modèles de CV d'EXEMPLE (données fictives « Prénom Nom », visuels déposés dans le bucket
--   stories-media) ; bouton « Commander via WhatsApp » (WhatsApp de Facilité). À remplacer par de vrais visuels depuis
--   Administration → Stories quand ils existeront.
-- - CV Professionnel : l'affiche réelle des services et tarifs de confection de CV (déjà créée).
-- - Offre Comptable et Offre Développeur : de vraies offres publiées sur Facilité (visuel de l'offre), de type « offre » —
--   donc TOUJOURS accompagnées du bouton « Postuler » vers la page de l'offre.
-- Idempotent : une story du même titre n'est jamais créée deux fois.

INSERT INTO public.stories (titre, image_url, libelle_bouton, lien, type, ordre, actif)
SELECT 'CV Moderne', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/stories-media/story-modele-cv-moderne.png', 'Commander via WhatsApp', NULL, 'cv', 1, true
WHERE NOT EXISTS (SELECT 1 FROM public.stories WHERE titre = 'CV Moderne');

INSERT INTO public.stories (titre, image_url, libelle_bouton, lien, type, ordre, actif)
SELECT 'Offre Comptable', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/admin-posters/poster-1787531449519.jpeg', 'Postuler', 'https://ffacilite.com/offres/10accfcf-12f4-45fb-88b5-009c701c7ebe', 'offre', 2, true
WHERE NOT EXISTS (SELECT 1 FROM public.stories WHERE titre = 'Offre Comptable');

UPDATE public.stories SET ordre = 3 WHERE titre = 'CV Professionnel';

INSERT INTO public.stories (titre, image_url, libelle_bouton, lien, type, ordre, actif)
SELECT 'Offre Développeur', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/job-offers/fadel_pub2_v2.jpg', 'Postuler', 'https://ffacilite.com/offres/402cd388-5e86-4082-950b-fb5ec69f4e9e', 'offre', 4, true
WHERE NOT EXISTS (SELECT 1 FROM public.stories WHERE titre = 'Offre Développeur');

INSERT INTO public.stories (titre, image_url, libelle_bouton, lien, type, ordre, actif)
SELECT 'CV Étudiant', 'https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public/stories-media/story-modele-cv-etudiant.png', 'Commander via WhatsApp', NULL, 'cv', 5, true
WHERE NOT EXISTS (SELECT 1 FROM public.stories WHERE titre = 'CV Étudiant');
