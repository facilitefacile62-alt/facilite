-- Colonnes de suivi pour le cron de relances automatiques
-- (/api/cron/reminders) : sans elles, la même candidature "pending" ou le
-- même brouillon de CV abandonné recevrait une relance à CHAQUE exécution
-- quotidienne du cron, indéfiniment. reminder_sent_at NULL = jamais
-- relancé ; une fois renseigné, la ligne ne sera plus jamais reciblée
-- (relance unique, pas récurrente).

ALTER TABLE public.candidatures
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

ALTER TABLE public.resumes
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
