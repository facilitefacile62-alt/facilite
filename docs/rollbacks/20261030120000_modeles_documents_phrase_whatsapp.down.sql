-- Retour arrière de 20261030120000_modeles_documents_phrase_whatsapp.sql : retire la colonne (les phrases saisies sont perdues ; les messages reprennent la phrase par défaut).
ALTER TABLE public.modeles_documents DROP COLUMN IF EXISTS message_whatsapp;
