-- Annulation de 20261025150000_profiles_valeurs_par_defaut_vides.sql (à passer par un fichier, jamais dans l'éditeur du dashboard).
-- Remet les anciennes valeurs par défaut d'exemple (pour les futurs comptes seulement ; aucune ligne existante n'est touchée).
ALTER TABLE public.profiles
  ALTER COLUMN languages SET DEFAULT '[{"name": "Français", "level": "Principal / Courant"}]'::jsonb,
  ALTER COLUMN skills SET DEFAULT '["Gestion de projet", "Développement Web", "Stratégie Digitale"]'::jsonb;
