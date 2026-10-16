-- Débloquer une livraison dont le livreur ne répond plus.
--
-- Constat (état des lieux de la livraison, 16/10/2026) : si un livreur disparaît après avoir
-- récupéré le colis, personne ne pouvait débloquer la commande — le livreur ne peut libérer
-- qu'AVANT le retrait, l'acheteur ne peut annuler qu'AVANT le départ — seule une intervention
-- directe en base aurait suffi.
--
-- CHOIX
--  * L'acheteur ne peut PAS décider seul : après le retrait le colis est entre les mains du
--    livreur ; remettre la commande dans le tableau ou l'annuler sans que personne ne vérifie
--    ouvrirait la porte aux abus (un acheteur qui a reçu son colis et « signale » pour ne pas
--    confirmer). Il SIGNALE, un administrateur TRANCHE.
--  * Le signalement n'est possible qu'après un délai d'inactivité, pour ne pas déranger un
--    livreur simplement en retard :
--       assigné, pas encore récupéré  : 3 h après la réclamation ;
--       récupéré, pas encore parti    : 2 h après le retrait ;
--       en livraison                  : 1 h sans nouvelle position.
--  * L'administrateur choisit : remettre la commande en attente d'un autre livreur,
--    l'annuler, ou classer sans suite. Tout le monde concerné est prévenu.
--
-- Aucune écriture directe : la table n'accorde que SELECT (invariant 1).

CREATE TABLE IF NOT EXISTS public.livraison_litiges (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id    UUID NOT NULL REFERENCES public.marketplace_commandes(id) ON DELETE CASCADE,
  signale_par    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  livreur_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  statut_commande TEXT NOT NULL,
  motif          TEXT CHECK (motif IS NULL OR char_length(motif) <= 300),
  resolu_le      TIMESTAMPTZ,
  resolu_par     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution     TEXT CHECK (resolution IS NULL OR resolution IN ('remettre_en_attente', 'annuler', 'classer')),
  note_admin     TEXT CHECK (note_admin IS NULL OR char_length(note_admin) <= 300),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un seul signalement ouvert par commande.
CREATE UNIQUE INDEX IF NOT EXISTS idx_livraison_litiges_un_ouvert
  ON public.livraison_litiges (commande_id) WHERE resolu_le IS NULL;
CREATE INDEX IF NOT EXISTS idx_livraison_litiges_ouverts ON public.livraison_litiges (created_at) WHERE resolu_le IS NULL;

ALTER TABLE public.livraison_litiges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parties lisent le litige de leur livraison" ON public.livraison_litiges;
CREATE POLICY "parties lisent le litige de leur livraison" ON public.livraison_litiges
  FOR SELECT TO authenticated
  USING (
    signale_par = auth.uid()
    OR livreur_id = auth.uid()
    OR public.is_admin(auth.uid())
  );

REVOKE ALL ON public.livraison_litiges FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.livraison_litiges TO authenticated;

-- ---------------------------------------------------------------------------
-- Signaler (acheteur)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.signaler_livraison_bloquee(p_commande_id UUID, p_motif TEXT DEFAULT NULL)
RETURNS public.livraison_litiges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi    UUID := auth.uid();
  v_c      public.marketplace_commandes;
  v_depuis TIMESTAMPTZ;
  v_delai  INTERVAL;
  v_row    public.livraison_litiges;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;
  IF p_motif IS NOT NULL AND char_length(p_motif) > 300 THEN
    RAISE EXCEPTION 'Le motif fait 300 caractères au maximum.';
  END IF;

  SELECT * INTO v_c FROM public.marketplace_commandes WHERE id = p_commande_id AND acheteur_id = v_moi FOR UPDATE;
  IF v_c.id IS NULL THEN
    RAISE EXCEPTION 'Commande introuvable.';
  END IF;
  IF v_c.statut NOT IN ('assignee', 'recuperee', 'en_livraison') THEN
    RAISE EXCEPTION 'Cette commande n''est pas en cours de livraison : rien à signaler.';
  END IF;

  IF v_c.statut = 'assignee' THEN
    v_depuis := v_c.assignee_le;
    v_delai := interval '3 hours';
  ELSIF v_c.statut = 'recuperee' THEN
    v_depuis := v_c.recuperee_le;
    v_delai := interval '2 hours';
  ELSE
    v_depuis := coalesce(v_c.livreur_position_maj_le, v_c.en_livraison_le);
    v_delai := interval '1 hour';
  END IF;
  IF v_depuis IS NULL OR v_depuis > now() - v_delai THEN
    RAISE EXCEPTION 'Le livreur a encore un peu de temps : vous pourrez signaler un blocage si la livraison n''avance pas (% heure(s) d''inactivité).',
      CASE WHEN v_c.statut = 'assignee' THEN 3 WHEN v_c.statut = 'recuperee' THEN 2 ELSE 1 END;
  END IF;
  IF EXISTS (SELECT 1 FROM public.livraison_litiges WHERE commande_id = v_c.id AND resolu_le IS NULL) THEN
    RAISE EXCEPTION 'Un signalement est déjà en cours d''examen pour cette commande.';
  END IF;

  INSERT INTO public.livraison_litiges (commande_id, signale_par, livreur_id, statut_commande, motif)
  VALUES (v_c.id, v_moi, v_c.livreur_id, v_c.statut, nullif(btrim(coalesce(p_motif, '')), ''))
  RETURNING * INTO v_row;

  -- Les administrateurs, le livreur et le vendeur sont prévenus.
  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  SELECT r.user_id, v_moi, 'marketplace_commande', 'Livraison bloquée signalée par un acheteur : à examiner.', '/admin/litiges-livraison'
  FROM public.user_roles r WHERE r.role = 'admin';

  IF v_c.livreur_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, actor_id, type, content, link)
    VALUES (v_c.livreur_id, v_moi, 'marketplace_commande', 'L''acheteur signale que votre livraison n''avance plus : faites-la avancer ou contactez-le.', '/marketplace?onglet=livrer');
  END IF;
  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  SELECT s.owner_id, v_moi, 'marketplace_commande', 'Une livraison de votre boutique est signalée comme bloquée.', '/marketplace?onglet=vendre&tab=commandes'
  FROM public.marketplace_stores s WHERE s.id = v_c.store_id;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.signaler_livraison_bloquee(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.signaler_livraison_bloquee(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Trancher (administrateur)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resoudre_litige_livraison(p_litige_id UUID, p_action TEXT, p_note TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_l   public.livraison_litiges;
  v_c   public.marketplace_commandes;
BEGIN
  IF v_moi IS NULL OR NOT public.is_admin(v_moi) THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('remettre_en_attente', 'annuler', 'classer') THEN
    RAISE EXCEPTION 'Action inconnue : remettre_en_attente, annuler ou classer.';
  END IF;
  IF p_note IS NOT NULL AND char_length(p_note) > 300 THEN
    RAISE EXCEPTION 'La note fait 300 caractères au maximum.';
  END IF;

  SELECT * INTO v_l FROM public.livraison_litiges WHERE id = p_litige_id AND resolu_le IS NULL FOR UPDATE;
  IF v_l.id IS NULL THEN
    RETURN FALSE;
  END IF;
  SELECT * INTO v_c FROM public.marketplace_commandes WHERE id = v_l.commande_id FOR UPDATE;

  -- La commande n'est touchée que si elle est encore en cours : si elle a avancé entre-temps
  -- (livrée, annulée…), le signalement est simplement classé.
  IF p_action = 'remettre_en_attente' AND v_c.id IS NOT NULL AND v_c.statut IN ('assignee', 'recuperee', 'en_livraison') THEN
    UPDATE public.marketplace_commandes
    SET livreur_id = NULL, statut = 'en_attente_livreur', assignee_le = NULL, recuperee_le = NULL, en_livraison_le = NULL,
        livreur_position_lat = NULL, livreur_position_lng = NULL, livreur_position_maj_le = NULL,
        groupage_id = NULL, groupage_decision = NULL
    WHERE id = v_c.id;
  ELSIF p_action = 'annuler' AND v_c.id IS NOT NULL AND v_c.statut IN ('assignee', 'recuperee', 'en_livraison') THEN
    UPDATE public.marketplace_commandes
    SET statut = 'annulee', annulee_le = now(), motif_annulation = coalesce(nullif(btrim(coalesce(p_note, '')), ''), 'Livraison bloquée : annulée par l''administrateur')
    WHERE id = v_c.id;
  END IF;

  UPDATE public.livraison_litiges
  SET resolu_le = now(), resolu_par = v_moi, resolution = p_action, note_admin = nullif(btrim(coalesce(p_note, '')), '')
  WHERE id = v_l.id;

  INSERT INTO public.notifications (user_id, actor_id, type, content, link)
  VALUES (
    v_l.signale_par, v_moi, 'marketplace_commande',
    CASE p_action
      WHEN 'remettre_en_attente' THEN 'Votre livraison bloquée a été remise à disposition d''un autre livreur.'
      WHEN 'annuler' THEN 'Votre commande bloquée a été annulée par l''administration.'
      ELSE 'Votre signalement de livraison a été examiné et classé.' END,
    '/marketplace?onglet=acheter'
  );
  IF v_l.livreur_id IS NOT NULL AND p_action IN ('remettre_en_attente', 'annuler') THEN
    INSERT INTO public.notifications (user_id, actor_id, type, content, link)
    VALUES (v_l.livreur_id, v_moi, 'marketplace_commande', 'Une livraison que vous aviez prise vous a été retirée par l''administration.', '/marketplace?onglet=livrer');
  END IF;

  PERFORM public.log_security_event('livraison_litige_resolu', 'info', v_moi, v_l.livreur_id, jsonb_build_object('litige_id', v_l.id, 'commande_id', v_l.commande_id, 'action', p_action));
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.resoudre_litige_livraison(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resoudre_litige_livraison(UUID, TEXT, TEXT) TO authenticated;
