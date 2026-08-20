-- Active RLS sur processed_webhooks (table de déduplication des webhooks
-- de paiement, créée pour le worker RabbitMQ le 2026-08-18 sans RLS).
-- Aucune exploitation active constatée : la table n'avait aucun GRANT vers
-- anon/authenticated (seuls postgres/service_role), donc inatteignable via
-- PostgREST malgré RLS désactivée — mais viole l'invariant 2 (aucune table
-- sans protection), et une régression future sur les GRANTs redeviendrait
-- silencieusement exploitable sans ce filet. Corrigé en base directement
-- (incident du 18/08 : toute modification passe désormais par un fichier
-- de migration commité, jamais l'éditeur SQL Supabase).
--
-- Patron identique à kpay_webhook_logs (20260817030000) : le payload brut
-- (payment_status, tokens, identifiants de transaction) ne doit jamais être
-- exposé à un candidat/recruteur, lecture réservée aux admins ;
-- append-only pour authenticated/anon (aucun GRANT INSERT/UPDATE/DELETE),
-- seule service_role (webhooksWorker.js) écrit.

ALTER TABLE public.processed_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Seuls les admins lisent les webhooks traités" ON public.processed_webhooks;
CREATE POLICY "Seuls les admins lisent les webhooks traités" ON public.processed_webhooks
  FOR SELECT USING (public.is_admin(auth.uid()));

-- GRANT SELECT explicite requis depuis la correction DEFAULT PRIVILEGES
-- (20260807130000) pour que la policy ci-dessus ait quelque chose à
-- filtrer — sans GRANT INSERT/UPDATE/DELETE, cohérent avec kpay_webhook_logs.
GRANT SELECT ON public.processed_webhooks TO authenticated;
