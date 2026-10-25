-- ANNULATION de supabase/migrations/20261024120000_coordonnees_cv_et_confirmation_whatsapp.sql.
-- Pas une migration (volontairement hors de supabase/migrations/). Application : npx supabase db query --linked --yes -f <ce fichier>
-- Effets : supprime la confirmation WhatsApp (table des codes, fonction, déclencheur, colonne whatsapp_confirme_numero) et les trois colonnes
-- des coordonnées du CV (cv_telephone, cv_email, cv_ville) — leur contenu est PERDU : l'exporter avant si des candidats les ont remplies.
-- Retirer d'abord l'application qui les lit (écran « Coordonnées du CV », route /api/marketplace/whatsapp-code).
DROP TRIGGER IF EXISTS reinitialiser_confirmation_whatsapp ON public.marketplace_stores;
DROP FUNCTION IF EXISTS public.reinitialiser_confirmation_whatsapp();
DROP FUNCTION IF EXISTS public.confirmer_whatsapp_boutique(UUID, TEXT);
DROP TABLE IF EXISTS public.whatsapp_confirmations;
ALTER TABLE public.marketplace_stores DROP COLUMN IF EXISTS whatsapp_confirme_numero;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS cv_telephone, DROP COLUMN IF EXISTS cv_email, DROP COLUMN IF EXISTS cv_ville;
