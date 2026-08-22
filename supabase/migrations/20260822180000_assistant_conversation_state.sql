-- Machine à états du tunnel CV (point 3, 2026-08-22).
--
-- /api/ai-chat est sans état entre deux requêtes (aucune session serveur,
-- l'historique complet est renvoyé par le client à chaque appel) : il faut
-- donc un endroit où persister "à quelle étape du tunnel en est ce
-- candidat" pour que le CODE puisse imposer l'ordre et l'unicité de la
-- question posée à chaque tour, indépendamment de ce que le modèle
-- déciderait spontanément (c'est précisément ce qui manquait à l'agent
-- WhatsApp : un prompt détaillé mais jamais réellement suivi).
--
-- Une ligne par candidat (le fil "Support RH Facilité" est un unique fil
-- épinglé par utilisateur, jamais plusieurs conversations distinctes —
-- voir MessagerieClient.js, AI_PINNED_CHAT). Bookkeeping interne au
-- pipeline serveur uniquement : même patron que assistant_ai_config
-- (20260821130000_assistant_ai_studio.sql) — verrouillé service_role,
-- 0 policy RLS, jamais lu ni écrit directement par le client.
CREATE TABLE public.assistant_conversation_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_step TEXT NOT NULL DEFAULT 'accueil',
  collected_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.assistant_conversation_state ENABLE ROW LEVEL SECURITY;
-- Aucune policy, aucun GRANT à authenticated/anon — service_role
-- uniquement, comme assistant_ai_config.

CREATE TRIGGER trg_assistant_conversation_state_updated_at
  BEFORE UPDATE ON public.assistant_conversation_state
  FOR EACH ROW EXECUTE FUNCTION public.set_assistant_ai_updated_at();
