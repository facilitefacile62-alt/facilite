-- Interrupteur admin « numéro WhatsApp visible » sur la page d'aide
-- (/aide-candidature sur le site, écran « Aide » de l'application).
-- Quand l'administrateur le coupe, le bloc « Accompagnement » avec le numéro, le
-- lien « Nous contacter » et la mention WhatsApp disparaissent : plus personne
-- ne peut écrire à ce numéro depuis ces pages. Activé par défaut (c'est
-- l'affichage actuel). La colonne est lue publiquement avec le reste de la ligne
-- (GRANT SELECT existant) ; l'écriture reste réservée à /api/admin/aide-video.
ALTER TABLE public.aide_video
  ADD COLUMN IF NOT EXISTS whatsapp_visible boolean NOT NULL DEFAULT true;
