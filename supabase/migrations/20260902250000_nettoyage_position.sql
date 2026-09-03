-- Retirer une colonne morte, héritée d'un mauvais premier modèle.
--
-- `changements_position` comptait les déplacements d'UNE boutique — le modèle
-- de la migration 20260902220000, avant qu'il ne devienne clair qu'un
-- commerçant qui grandit n'a pas besoin de déplacer sa boutique : il en ouvre
-- une seconde (20260902240000_boutiques_multiples).
--
-- La colonne n'a jamais été lue ni écrite après sa création : aucune fonction
-- ne la touche, aucun écran ne l'affiche. La garder serait laisser une
-- question sans réponse dans le schéma — « à quoi sert ce chiffre ? » — pour
-- la prochaine personne qui lira la table.

ALTER TABLE public.marketplace_stores
  DROP COLUMN IF EXISTS changements_position;
