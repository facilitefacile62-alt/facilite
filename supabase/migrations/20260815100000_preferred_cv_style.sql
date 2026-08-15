-- Migration 20260815100000_preferred_cv_style.sql
-- Point 3 (sauvegarde du style CV préféré) : stocke la dernière couleur
-- d'accent et police choisies dans /creer-cv pour un utilisateur connecté,
-- afin de les proposer au démarrage de sa prochaine session (bandeau
-- "Réutiliser votre dernier style ?").
-- Colonne nullable : aucune valeur par défaut n'est imposée, les profils
-- existants restent NULL tant que l'utilisateur n'a rien appliqué depuis
-- /creer-cv. Pas de GRANT à ajouter : profiles a déjà une policy RLS
-- owner-only sur UPDATE qui couvre toute nouvelle colonne du même schéma.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS preferred_cv_style JSONB;
