-- Annulation de 20261025220000_interrupteur_connexion_telephone.sql (à passer par un fichier, jamais dans l'éditeur du dashboard).
-- Supprime la ligne de l'interrupteur : sans elle, le site et l'application considèrent le téléphone FERMÉ (comportement par défaut du code).
DELETE FROM public.feature_flags WHERE id = 'feat_connexion_telephone';
