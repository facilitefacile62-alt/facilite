-- Annulation de 20261025190000_informations_compte.sql (à passer par un fichier, jamais dans l'éditeur du dashboard).
-- ATTENTION : supprime le journal de sécurité et les codes en cours. Les téléphones et e-mails déjà changés ou dissociés ne sont PAS remis comme avant.
DELETE FROM public.feature_flags WHERE id = 'feat_compte_telephone';
DROP FUNCTION IF EXISTS public.compte_valeur_prise(TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.compte_dissocier_methode(UUID, TEXT);
DROP TRIGGER IF EXISTS synchroniser_contact_profil ON auth.users;
DROP FUNCTION IF EXISTS public.synchroniser_contact_profil();
DROP TABLE IF EXISTS public.compte_verifications;
DROP TABLE IF EXISTS public.compte_journal_securite;
