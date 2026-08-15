-- Migration 20260815120000_canva_tokens.sql
-- Étape 1.B (intégration Canva Autofill) : stocke le token OAuth Canva par
-- utilisateur, échangé par /api/canva/callback et rafraîchi par
-- /api/canva/refresh.
--
-- INSERT/UPDATE jamais depuis le client : les deux routes ci-dessus
-- utilisent getSupabaseAdmin() (service_role, contourne RLS) — même schéma
-- que log_security_event()/notifications dans ce dépôt, où aucune table ne
-- GRANT UPDATE/DELETE à authenticated/anon (liste blanche de l'invariant 1
-- vide, vérifiée avant cette migration). Les policies UPDATE/DELETE
-- ci-dessous restent définies par complétude défensive (cohérent avec le
-- reste du schéma) mais sont inertes pour authenticated tant qu'aucun GRANT
-- ne les active — seul SELECT est accordé au client, pour que /creer-cv
-- puisse savoir si l'utilisateur est déjà connecté à Canva sans passer par
-- une route API dédiée.

CREATE TABLE IF NOT EXISTS public.canva_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.canva_tokens ENABLE ROW LEVEL SECURITY;

-- Table fraîchement créée : aucun droit hérité pour anon/authenticated
-- (20260807130000_fix_default_privileges_public_schema.sql) — ce GRANT
-- SELECT est donc le seul droit client sur cette table.
GRANT SELECT ON public.canva_tokens TO authenticated;

DROP POLICY IF EXISTS "Lecture de son propre token Canva" ON public.canva_tokens;
CREATE POLICY "Lecture de son propre token Canva" ON public.canva_tokens
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Modification de son propre token Canva" ON public.canva_tokens;
CREATE POLICY "Modification de son propre token Canva" ON public.canva_tokens
  FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Suppression de son propre token Canva" ON public.canva_tokens;
CREATE POLICY "Suppression de son propre token Canva" ON public.canva_tokens
  FOR DELETE USING ((select auth.uid()) = user_id);
