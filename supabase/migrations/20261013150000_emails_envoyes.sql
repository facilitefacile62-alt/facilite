-- Journal des e-mails écrits par les utilisateurs depuis le bouton « Écrire un
-- e-mail » de l'application (route /api/envoyer-email). Il sert à UNE chose :
-- plafonner le nombre d'envois par utilisateur et par 24 h, pour que Facilité ne
-- devienne pas un relais de spam. On y garde le destinataire et l'objet, jamais
-- le contenu du message ni les pièces jointes.
--
-- Table réservée à service_role : RLS activée, AUCUNE policy, aucun GRANT à
-- anon/authenticated — lecture et écriture passent exclusivement par la route
-- serveur (après contrôle de session).

CREATE TABLE IF NOT EXISTS public.emails_envoyes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  destinataire text        NOT NULL,
  objet        text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS emails_envoyes_user_date_idx ON public.emails_envoyes (user_id, created_at DESC);

ALTER TABLE public.emails_envoyes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.emails_envoyes FROM PUBLIC, anon, authenticated;
