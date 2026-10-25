-- Annulation de 20261025210000_journal_envois_sms.sql (à passer par un fichier, jamais dans l'éditeur du dashboard).
-- Supprime le journal des envois de SMS (historique perdu). Le hook, lui, continue de fonctionner : le journal ne bloque jamais l'envoi.
DROP TABLE IF EXISTS public.sms_envois_journal;
