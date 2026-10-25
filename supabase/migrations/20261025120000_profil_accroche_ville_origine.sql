-- Profil — À propos : « Intro » et « Informations personnelles » (demande du 25/10/2026).
--  - accroche : la PHRASE D'ACCROCHE, distincte de la bio (jusqu'ici l'écran Intro affichait la bio sous le titre « Phrase d'accroche ») ;
--  - ville_origine : la VILLE D'ORIGINE (l'écran affichait « Pays / origine », qui n'était que le pays).
-- Colonnes vides tant que la personne ne les remplit pas. Même règle que le reste du profil : lecture et écriture par colonne pour
-- « authenticated », la policy « son propre profil » limite l'écriture à la ligne de la personne. Rien n'est modifié ni supprimé.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS accroche TEXT CHECK (accroche IS NULL OR char_length(accroche) <= 160),
  ADD COLUMN IF NOT EXISTS ville_origine TEXT CHECK (ville_origine IS NULL OR char_length(ville_origine) <= 80);

GRANT SELECT (accroche, ville_origine), UPDATE (accroche, ville_origine) ON public.profiles TO authenticated;
