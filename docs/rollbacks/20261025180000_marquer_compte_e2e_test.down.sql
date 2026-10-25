-- Annulation de 20261025180000_marquer_compte_e2e_test.sql (à passer par un fichier, jamais dans l'éditeur du dashboard).
-- Remet ce seul compte comme avant (non marqué comme compte de test).
UPDATE public.profiles
   SET is_test_account = false
 WHERE id = '30000000-0000-4000-a000-000000000001'
   AND is_test_account = true
   AND email ILIKE 'e2e-%';
