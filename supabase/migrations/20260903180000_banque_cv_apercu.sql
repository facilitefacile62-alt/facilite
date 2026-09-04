-- Aperçu visuel des CV de la banque : la liste admin n'affichait que du
-- texte (nom, catégorie, résumé), sans miniature du document lui-même —
-- demande explicite de l'utilisateur après avoir vu la liste en place.
--
-- Chemin de stockage vers une vignette PNG dans le même bucket privé
-- "banque-cv" que fichier_cv/fichier_lettre (voir 20260903120000_banque_cv.sql
-- pour la doctrine : RLS activée, ZÉRO policy, ZÉRO grant — accès exclusif via
-- service_role, comme le reste de la table). Nullable : un CV DOCX n'a pas de
-- rendu visuel généré (pas de moteur de rendu DOCX dans ce projet), et les CV
-- déjà importés avant cette migration n'ont pas de vignette rétroactive — la
-- liste retombe sur une icône générique dans ces deux cas, jamais une erreur.
ALTER TABLE public.banque_cv
  ADD COLUMN IF NOT EXISTS apercu_cv TEXT;
