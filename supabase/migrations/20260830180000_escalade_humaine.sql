-- Escalade humaine : savoir qui répond, et le dire.
--
-- Aujourd'hui, demander à parler à un humain ne produit RIEN. handleContactSupport
-- se contente de basculer l'affichage sur le fil de l'assistant ; aucun humain
-- n'est sollicité, aucune trace n'est laissée, et la personne continue de
-- dialoguer avec l'IA sans le savoir. Le seul mécanisme existant est un
-- interrupteur côté administrateur dont l'état vit dans un useState React :
-- il disparaît au rechargement, et l'interlocuteur n'en sait rien.
--
-- On étend public.support_threads plutôt que de créer une table parallèle :
-- elle existe déjà, elle est clé par user_id — exactement la granularité du
-- fil d'assistance — et elle porte déjà ses policies RLS ainsi que le panneau
-- /admin/support. Son `status` (unread/in_progress/resolved) décrit le
-- traitement du ticket ; le nouveau `mode` décrit QUI TIENT LA CONVERSATION.
-- Deux questions distinctes, deux colonnes.

ALTER TABLE public.support_threads
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'ia'
    CHECK (mode IN ('ia', 'attente_humain', 'humain')),
  ADD COLUMN IF NOT EXISTS mode_motif TEXT,
  ADD COLUMN IF NOT EXISTS mode_change_le TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mode_change_par UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Notifications : nouveau type pour l'escalade.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'jobs', 'posts', 'mentions', 'candidature', 'reponse',
    'badge', 'message', 'system', 'document_access', 'document_delivery',
    'support_escalade'
  ]));

-- ---------------------------------------------------------------------------
-- La personne demande un humain.
-- ---------------------------------------------------------------------------
-- Appelée par l'outil demander_un_humain, donc à l'initiative de l'assistant
-- quand il détecte une demande EXPLICITE. Jamais l'inverse : rien ici ne
-- permet de repasser quelqu'un en mode IA sans son accord — c'est le rôle de
-- repondre_escalade, réservée aux administrateurs.
CREATE OR REPLACE FUNCTION public.demander_un_humain(p_motif TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi   UUID := auth.uid();
  v_mode  TEXT;
  v_admin RECORD;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;

  INSERT INTO public.support_threads (user_id, status, mode, mode_motif, mode_change_le, mode_change_par, last_message_at)
  VALUES (v_moi, 'unread', 'attente_humain', nullif(btrim(coalesce(p_motif, '')), ''), now(), v_moi, now())
  ON CONFLICT (user_id) DO UPDATE SET
    -- Un fil déjà pris en charge par un humain ne redescend pas en attente :
    -- la personne parle déjà à quelqu'un, la reclasser ferait disparaître le
    -- fil de la file des conseillers.
    mode = CASE WHEN public.support_threads.mode = 'humain' THEN 'humain' ELSE 'attente_humain' END,
    mode_motif = COALESCE(nullif(btrim(coalesce(p_motif, '')), ''), public.support_threads.mode_motif),
    mode_change_le = now(),
    mode_change_par = v_moi,
    status = CASE WHEN public.support_threads.status = 'resolved' THEN 'unread' ELSE public.support_threads.status END,
    last_message_at = now()
  RETURNING mode INTO v_mode;

  -- Un administrateur doit l'apprendre sans surveiller un écran. La
  -- notification part à chacun d'eux : il n'existe pas de file d'attente
  -- partagée, le premier disponible prend la main.
  FOR v_admin IN
    SELECT ur.user_id FROM public.user_roles ur
    WHERE ur.role = 'admin' AND ur.status = 'active'
  LOOP
    INSERT INTO public.notifications (user_id, actor_id, type, content, link)
    VALUES (
      v_admin.user_id,
      v_moi,
      'support_escalade',
      'Une personne demande à parler à un conseiller.' ||
        CASE WHEN nullif(btrim(coalesce(p_motif, '')), '') IS NOT NULL
             THEN ' Motif : ' || btrim(p_motif) ELSE '' END,
      '/admin/support'
    );
  END LOOP;

  RETURN jsonb_build_object('mode', v_mode, 'notifie', true);
END;
$$;

REVOKE ALL ON FUNCTION public.demander_un_humain(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.demander_un_humain(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Un administrateur prend la main, ou la rend.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.repondre_escalade(p_user_id UUID, p_mode TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin UUID := auth.uid();
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;
  IF p_mode NOT IN ('ia', 'humain') THEN
    RAISE EXCEPTION 'Mode invalide : % (attendu ia ou humain).', p_mode;
  END IF;

  UPDATE public.support_threads
  SET mode = p_mode,
      mode_change_le = now(),
      mode_change_par = v_admin,
      status = CASE WHEN p_mode = 'humain' THEN 'in_progress' ELSE status END
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN RETURN false; END IF;

  -- La personne est prévenue du changement : savoir qu'un humain a pris le
  -- relais, ou que l'assistant reprend, fait partie de la conversation.
  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  VALUES (
    p_user_id,
    v_admin,
    'support_escalade',
    CASE WHEN p_mode = 'humain'
         THEN 'Un conseiller Facilité a pris le relais dans votre conversation.'
         ELSE 'L''assistant automatique reprend votre conversation.' END,
    '/messagerie'
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.repondre_escalade(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.repondre_escalade(UUID, TEXT) TO authenticated;
