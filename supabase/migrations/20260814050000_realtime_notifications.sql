-- =====================================================================
-- NOTIFICATIONS — étape C : ajoute notifications à la publication
-- Realtime. Sans cette migration, aucune souscription postgres_changes
-- côté frontend ne reçoit jamais rien sur cette table, quel que soit le
-- code écrit (Postgres ne publie que ce qui est explicitement dans la
-- publication) — même constat que pour job_offers/profiles
-- (20260813223000_realtime_job_offers_profiles.sql).
--
-- Isolation par utilisateur : postgres_changes évalue la policy RLS
-- SELECT de la table (déjà en place depuis l'étape A — "Lecture de ses
-- propres notifications", USING (select auth.uid()) = user_id) au moment
-- de livrer chaque événement à un abonné donné — aucune configuration de
-- canal supplémentaire n'est nécessaire pour que l'isolement soit
-- structurel, pas applicatif.
-- =====================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
