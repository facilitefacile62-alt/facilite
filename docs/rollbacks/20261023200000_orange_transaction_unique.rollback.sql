-- ANNULATION de supabase/migrations/20261023200000_orange_transaction_unique.sql (unicité du transactionId Orange).
--
-- À utiliser seulement en cas de besoin, et PAS en tant que migration : ce fichier n'est volontairement pas sous supabase/migrations/.
-- Il s'applique comme les migrations, par : npx supabase db query --linked --yes -f docs/rollbacks/20261023200000_orange_transaction_unique.rollback.sql
--
-- Effets :
--  - supprime les deux index uniques (un même transactionId Orange pourrait de nouveau servir deux fois) ;
--  - supprime la colonne formation_redaction_cv_inscriptions.orange_transaction_id : les identifiants Orange qu'elle contient sont PERDUS.
--    À n'exécuter qu'après avoir exporté cette colonne si des inscriptions ont déjà été payées.
-- Aucune autre table, politique ni fonction n'est touchée. Le code déployé qui écrit orange_transaction_id doit être retiré AVANT ou en
-- même temps, sinon l'enregistrement d'un paiement de formation échouerait.
DROP INDEX IF EXISTS public.jetons_transactions_orange_tx_unique;
DROP INDEX IF EXISTS public.formation_redaction_cv_orange_tx_unique;
ALTER TABLE public.formation_redaction_cv_inscriptions DROP COLUMN IF EXISTS orange_transaction_id;
