-- Arrêt à la source des valeurs d'EXEMPLE dans les nouveaux profils.
--
-- Origine constatée (25/10/2026) : ce ne sont ni le déclencheur d'inscription (handle_new_user n'écrit que id, e-mail, nom), ni le code des applications, mais
-- les valeurs PAR DÉFAUT des colonnes profiles.languages et profiles.skills, créées à la main avant que les migrations ne soient suivies (elles ne figurent
-- dans aucune migration ; seul l'ancien export du schéma les montre) :
--   languages : [{"name": "Français", "level": "Principal / Courant"}]
--   skills    : ["Gestion de projet", "Développement Web", "Stratégie Digitale"]
-- Chaque nouveau compte recevait donc, sans le savoir, une langue et trois compétences qu'il n'avait jamais saisies — vues ensuite par les recruteurs
-- (recherche de candidats, mise en correspondance) et comptées dans le score des candidatures.
--
-- Effet : les NOUVEAUX profils démarrent avec des listes vides. Aucune ligne existante n'est modifiée (voir 20261025160000 pour le nettoyage, à part).
ALTER TABLE public.profiles
  ALTER COLUMN languages SET DEFAULT '[]'::jsonb,
  ALTER COLUMN skills SET DEFAULT '[]'::jsonb;
