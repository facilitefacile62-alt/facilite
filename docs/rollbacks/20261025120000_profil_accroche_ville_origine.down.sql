-- Annulation de 20261025120000_profil_accroche_ville_origine.sql (à passer par un fichier, jamais dans l'éditeur du dashboard).
-- ATTENTION : supprime les phrases d'accroche et villes d'origine déjà saisies.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS accroche, DROP COLUMN IF EXISTS ville_origine;
