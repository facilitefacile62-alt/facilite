-- Décision du propriétaire du site (27/11/2026) : son compte de contact n'est pas un compte de test ; la marque est retirée.
-- Retour arrière : supabase/retours_arriere/20261127122000_compte_contact_pas_un_test.sql
update public.profiles set is_test_account = false where id = 'a729afb9-d8b7-41f9-84c0-e8fd207f8706' and is_test_account;
