-- Marquer le compte des tests automatiques (e-mail « e2e-… ») comme COMPTE DE TEST.
--
-- Constat (25/10/2026) : 4 comptes « e2e-… » existent ; trois sont déjà marqués is_test_account, un ne l'est pas (30000000-0000-4000-a000-000000000001). C'est lui qui a
-- créé en juillet-août les CV de test du créateur de CV (dont 105 « Conseiller Clientèle »). Non marqué, il compte comme un vrai utilisateur dans les statistiques et les
-- contrôles qui distinguent vrais comptes et comptes de test.
--
-- UNE SEULE LIGNE. Les garde-fous (is_test_account = false, e-mail commençant par « e2e- ») évitent de toucher un autre compte si l'identifiant ou l'état avait changé.
-- Retour arrière : docs/rollbacks/20261025180000_marquer_compte_e2e_test.down.sql.
UPDATE public.profiles
   SET is_test_account = true
 WHERE id = '30000000-0000-4000-a000-000000000001'
   AND is_test_account = false
   AND email ILIKE 'e2e-%';
