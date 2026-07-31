-- Sans cette migration, les abonnements Supabase Realtime ajoutés côté
-- client (postgres_changes sur candidatures/agent_assignments/orders) ne
-- reçoivent jamais aucun événement : seules les tables explicitement
-- ajoutées à la publication "supabase_realtime" sont diffusées, quelle que
-- soit la policy RLS. Vérifié en base : seules conversations/messages/
-- resumes y figuraient jusqu'ici.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'candidatures'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.candidatures;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'agent_assignments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_assignments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;
