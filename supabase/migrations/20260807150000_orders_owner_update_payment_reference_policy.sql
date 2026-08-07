-- =====================================================================
-- Corrige l'anomalie payment_reference NULL trouvée le 2026-08-07
-- (87/88 commandes). Cause exacte : 20260802250000_wave3_update_columns.sql
-- a déjà correctement restreint le GRANT UPDATE de `orders` à la seule
-- colonne payment_reference pour authenticated — mais aucune policy RLS
-- UPDATE n'existe sur cette table (seulement SELECT/INSERT). Le GRANT
-- colonne ne suffit pas seul : sans policy RLS, PostgREST/Postgres
-- rejette silencieusement (0 ligne affectée) toute tentative d'UPDATE,
-- même sur une colonne autorisée.
--
-- Cette policy n'élargit RIEN par elle-même : elle ne fait qu'activer ce
-- que le GRANT colonne de la vague 3 autorisait déjà à porter ses effets.
-- payment_status/amount/invoice_url restent inaccessibles en écriture au
-- propriétaire — pas parce que cette policy les exclut, mais parce que le
-- GRANT UPDATE (payment_reference) ne couvre qu'elle : Postgres refuse
-- toute colonne hors de ce GRANT indépendamment de ce que la policy RLS
-- autoriserait sur la ligne.
-- =====================================================================

CREATE POLICY "Un candidat met à jour la référence de paiement de sa propre commande"
  ON public.orders FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
