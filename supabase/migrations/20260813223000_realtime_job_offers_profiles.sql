-- =====================================================================
-- Point E1 du chantier en cours — ajoute job_offers et profiles à la
-- publication Realtime. Sans cette migration, aucune souscription
-- postgres_changes côté frontend ne reçoit jamais rien sur ces 2 tables,
-- quel que soit le code écrit (Postgres ne publie que ce qui est
-- explicitement dans la publication) — confirmé par une autre session
-- qui a déjà ajouté des souscriptions .channel(...) sur job_offers et
-- profiles (commit 299d057) sans cette étape : elles étaient inertes.
-- =====================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.job_offers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
