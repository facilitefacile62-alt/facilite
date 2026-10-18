-- « Signaler » un message reçu (menu d'actions d'un message, maquette 21).
--
-- Un utilisateur peut signaler un message d'une discussion à laquelle il participe (jamais le sien). Le signalement
-- est conservé dans messages_signalements, lisible par les seuls administrateurs ; les administrateurs sont prévenus
-- par une notification au tout premier signalement d'un message (au-delà, le compteur suffit : pas de doublons).
-- Même mécanique que signaler_annonce (20260902120000) : aucune écriture directe (invariant 1), tout passe par la
-- fonction SECURITY DEFINER, qui revérifie elle-même que l'appelant voit bien ce message.

CREATE TABLE IF NOT EXISTS public.messages_signalements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  motif       TEXT NOT NULL DEFAULT 'autre' CHECK (motif IN ('spam', 'harcelement', 'contenu_inapproprie', 'arnaque', 'autre')),
  statut      TEXT NOT NULL DEFAULT 'nouveau' CHECK (statut IN ('nouveau', 'traite')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_signalements_statut ON public.messages_signalements(statut, created_at DESC);

ALTER TABLE public.messages_signalements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "un admin lit les signalements de messages" ON public.messages_signalements;
CREATE POLICY "un admin lit les signalements de messages"
  ON public.messages_signalements FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

GRANT SELECT ON public.messages_signalements TO authenticated;

CREATE OR REPLACE FUNCTION public.signaler_message(p_message_id UUID, p_motif TEXT DEFAULT 'autre')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi     UUID := auth.uid();
  v_motif   TEXT := coalesce(nullif(btrim(coalesce(p_motif, '')), ''), 'autre');
  v_total   INT;
  v_nouveau BOOLEAN;
  v_admin   RECORD;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise pour signaler un message.';
  END IF;
  IF v_motif NOT IN ('spam', 'harcelement', 'contenu_inapproprie', 'arnaque', 'autre') THEN
    v_motif := 'autre';
  END IF;

  -- Le message doit appartenir à une discussion de l'appelant, et ne pas être de lui.
  IF NOT EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE m.id = p_message_id
      AND m.sender_id IS DISTINCT FROM v_moi
      AND (
        m.receiver_id = v_moi
        OR EXISTS (
          SELECT 1 FROM public.conversations c
          WHERE c.id = m.conversation_id AND (c.user_1_id = v_moi OR c.user_2_id = v_moi)
        )
      )
  ) THEN
    RAISE EXCEPTION 'Message introuvable.';
  END IF;

  INSERT INTO public.messages_signalements (message_id, reporter_id, motif)
  VALUES (p_message_id, v_moi, v_motif)
  ON CONFLICT (message_id, reporter_id) DO UPDATE SET motif = excluded.motif, statut = 'nouveau', created_at = now()
  RETURNING (xmax = 0) INTO v_nouveau;

  SELECT count(*)::int INTO v_total FROM public.messages_signalements WHERE message_id = p_message_id;

  IF v_nouveau AND v_total = 1 THEN
    FOR v_admin IN
      SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin' AND ur.status = 'active'
    LOOP
      INSERT INTO public.notifications (user_id, actor_id, type, content, link)
      VALUES (v_admin.user_id, v_moi, 'system', 'Un message a été signalé dans une discussion.', '/admin');
    END LOOP;
  END IF;

  RETURN jsonb_build_object('enregistre', true, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.signaler_message(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.signaler_message(UUID, TEXT) TO authenticated;
