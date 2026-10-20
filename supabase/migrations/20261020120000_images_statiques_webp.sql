-- Deux images servies par le site lui-même (dossier public/) passent en WebP : /pyxis_logistics_chauffeur.jpg (143 Ko → 56 Ko)
-- et /affiche_cv_pro.jpg (194 Ko → 109 Ko). Ce sont les deux images les plus lourdes du premier écran de l'accueil après la
-- conversion des affiches hébergées sur Supabase Storage (20261020100000).
--
-- ⚠️ À APPLIQUER APRÈS LE DÉPLOIEMENT du code qui ajoute public/*.webp : tant que ces fichiers ne sont pas en ligne,
-- basculer les adresses casserait l'image de l'offre et de la story concernées. Les .jpg restent en place (aperçus de
-- partage, données structurées). Retour arrière : remplacer .webp par .jpg dans les deux UPDATE.

UPDATE public.job_offers SET image_url = replace(image_url, '/pyxis_logistics_chauffeur.jpg', '/pyxis_logistics_chauffeur.webp') WHERE image_url LIKE '%/pyxis_logistics_chauffeur.jpg%';
UPDATE public.stories SET image_url = replace(image_url, '/affiche_cv_pro.jpg', '/affiche_cv_pro.webp') WHERE image_url LIKE '%/affiche_cv_pro.jpg%';
