-- Migration 20260817020000_disable_formation_feature.sql
--
-- Desactive "Formation (Certifications & cours pro)" (nav_plus_formation,
-- /offres?q=Formation) : ce lien ne mene pas a un vrai catalogue de
-- formations, juste a une recherche texte "Formation" sur job_offers, qui
-- remonte des offres d'emploi normales n'ayant aucun rapport (le mot
-- apparait par coincidence dans leur texte, ex. contrat "CDD/Formation").
-- Rien n'est modifie sur les offres d'emploi elles-memes, uniquement ce
-- bouton de navigation.

UPDATE public.feature_flags SET enabled = false, updated_at = now()
WHERE id = 'nav_plus_formation';
