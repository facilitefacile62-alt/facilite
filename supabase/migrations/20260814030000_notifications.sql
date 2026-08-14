-- NOTIFICATIONS — étape A : table + RLS (lecture et marquage "lu" par le
-- destinataire uniquement). L'écriture (création de notifications) est
-- volontairement absente ici : aucun GRANT INSERT à authenticated/anon.
-- Une fonction SECURITY DEFINER dédiée sera ajoutée à une étape ultérieure
-- une fois les points de déclenchement définis (nouveau message,
-- candidature, mention...) — même schéma que log_security_event()
-- (20260802070000_security_logs.sql) : seul du code serveur de confiance
-- écrit, jamais un INSERT direct depuis le navigateur.

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN (
    'jobs',           -- nouvelle offre
    'posts',          -- nouveau post
    'mentions',       -- mention
    'candidature',    -- nouvelle candidature reçue (recruteur)
    'reponse',        -- réponse du recruteur (candidat)
    'badge',          -- badge approuvé ou révoqué
    'message',        -- nouveau message de support
    'system'          -- notification système générique
  )),
  content TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id) WHERE is_read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Depuis 20260807130000_fix_default_privileges_public_schema.sql, une table
-- fraîchement créée n'hérite plus d'AUCUN droit pour anon/authenticated —
-- REVOKE INSERT/DELETE ci-dessous est donc un no-op défensif (déjà l'état
-- par défaut), documenté pour rester explicite si ce défaut venait à
-- changer. SEUL SELECT est accordé explicitement à authenticated : c'est
-- la seule opération que le client exécute directement sur cette table.
-- Le marquage "lu" (UPDATE) ne passe volontairement PAS par un GRANT UPDATE
-- table — vérification empirique faite ce jour : AUCUNE table de ce projet
-- n'accorde UPDATE/DELETE à authenticated/anon (la liste blanche de
-- l'invariant 1 est vide), toute mutation de ligne existante passe par une
-- fonction SECURITY DEFINER dédiée (is_admin, has_badge, deduct_credit...).
-- mark_notification_read() sera ajoutée à l'étape B selon ce même schéma,
-- sans jamais nécessiter de GRANT UPDATE direct ni d'entrée dans la liste
-- blanche de l'invariant 1.
REVOKE INSERT, UPDATE, DELETE ON public.notifications FROM authenticated, anon;
GRANT SELECT ON public.notifications TO authenticated;

DROP POLICY IF EXISTS "Lecture de ses propres notifications" ON public.notifications;
CREATE POLICY "Lecture de ses propres notifications" ON public.notifications
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Marquage lu de ses propres notifications" ON public.notifications;
CREATE POLICY "Marquage lu de ses propres notifications" ON public.notifications
  FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
