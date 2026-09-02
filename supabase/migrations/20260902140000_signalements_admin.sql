-- Lire et traiter les signalements côté administration.
--
-- La migration précédente enregistrait les signalements et prévenait les
-- administrateurs, mais rien ne permettait de les LIRE : la notification
-- pointait vers /admin, où aucun écran ne les affichait. Le signalement était
-- correctement stocké et parfaitement inexploitable.
--
-- Pourquoi une fonction plutôt qu'un SELECT direct : la policy de lecture de
-- marketplace_items ne montre que les articles ACTIFS. Un vendeur signalé qui
-- retire son annonce la ferait disparaître de l'écran d'administration —
-- exactement au moment où il faut la regarder. La fonction, en SECURITY
-- DEFINER, voit l'annonce quel que soit son état, après avoir vérifié que
-- l'appelant est bien administrateur.

-- ---------------------------------------------------------------------------
-- Lister les signalements
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lister_signalements(p_statut TEXT DEFAULT NULL)
RETURNS TABLE (
  id            UUID,
  motif         TEXT,
  details       TEXT,
  statut        TEXT,
  signale_le    TIMESTAMPTZ,
  reporter_id   UUID,
  item_id       UUID,
  titre         TEXT,
  prix_xof      INTEGER,
  item_actif    BOOLEAN,
  photos        JSONB,
  boutique_nom  TEXT,
  quartier      TEXT,
  ville         TEXT,
  vendeur_id    UUID,
  total_item    INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;

  RETURN QUERY
  SELECT
    r.id, r.motif, r.details, r.statut, r.created_at, r.reporter_id,
    i.id, i.titre, i.prix_xof, i.actif, i.photos,
    s.nom, s.quartier, s.ville, s.owner_id,
    (SELECT count(*)::int FROM public.marketplace_reports x WHERE x.item_id = i.id)
  FROM public.marketplace_reports r
  JOIN public.marketplace_items i ON i.id = r.item_id
  JOIN public.marketplace_stores s ON s.id = i.store_id
  WHERE p_statut IS NULL OR r.statut = p_statut
  -- Les non traités d'abord : c'est la file de travail, pas un journal.
  ORDER BY (r.statut = 'nouveau') DESC, r.created_at DESC
  LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.lister_signalements(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lister_signalements(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Trancher un signalement
-- ---------------------------------------------------------------------------
-- « traite » = le signalement était fondé et l'annonce a été retirée.
-- « rejete » = l'annonce est correcte, le signalement ne tient pas.
-- Le retrait de l'annonce est fait dans le même mouvement quand la décision
-- est « traite » : les séparer laisserait des annonces reconnues fautives en
-- ligne, le temps qu'un second geste soit oublié.
CREATE OR REPLACE FUNCTION public.traiter_signalement(p_id UUID, p_statut TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_item  UUID;
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;
  IF p_statut NOT IN ('traite', 'rejete') THEN
    RAISE EXCEPTION 'Statut invalide : % (attendu traite ou rejete).', p_statut;
  END IF;

  UPDATE public.marketplace_reports
  SET statut = p_statut
  WHERE id = p_id
  RETURNING item_id INTO v_item;

  IF v_item IS NULL THEN RETURN false; END IF;

  IF p_statut = 'traite' THEN
    -- Désactivation, jamais suppression : l'annonce sort des recherches mais
    -- la trace reste, ce qui permet de revenir sur la décision et de la
    -- justifier si le vendeur conteste.
    UPDATE public.marketplace_items SET actif = false WHERE id = v_item;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.traiter_signalement(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.traiter_signalement(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- La notification pointait vers /admin, où rien ne s'affichait.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.signaler_annonce(
  p_item_id UUID,
  p_motif   TEXT,
  p_details TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi     UUID := auth.uid();
  v_titre   TEXT;
  v_vendeur UUID;
  v_total   INT;
  v_nouveau BOOLEAN;
  v_admin   RECORD;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise pour signaler une annonce.';
  END IF;

  SELECT i.titre, s.owner_id INTO v_titre, v_vendeur
  FROM public.marketplace_items i
  JOIN public.marketplace_stores s ON s.id = i.store_id
  WHERE i.id = p_item_id;

  IF v_titre IS NULL THEN
    RAISE EXCEPTION 'Annonce introuvable.';
  END IF;
  IF v_vendeur = v_moi THEN
    RAISE EXCEPTION 'Vous ne pouvez pas signaler votre propre annonce.';
  END IF;

  INSERT INTO public.marketplace_reports (item_id, reporter_id, motif, details)
  VALUES (p_item_id, v_moi, p_motif, nullif(btrim(coalesce(p_details, '')), ''))
  ON CONFLICT (item_id, reporter_id) DO UPDATE SET
    motif = excluded.motif,
    details = excluded.details,
    statut = 'nouveau',
    created_at = now()
  RETURNING (xmax = 0) INTO v_nouveau;

  SELECT count(*)::int INTO v_total
  FROM public.marketplace_reports WHERE item_id = p_item_id;

  IF v_nouveau AND v_total = 1 THEN
    FOR v_admin IN
      SELECT ur.user_id FROM public.user_roles ur
      WHERE ur.role = 'admin' AND ur.status = 'active'
    LOOP
      INSERT INTO public.notifications (user_id, actor_id, type, content, link)
      VALUES (
        v_admin.user_id, v_moi, 'marketplace_signalement',
        'Annonce signalée : ' || left(v_titre, 80),
        '/admin/signalements'
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object('enregistre', true, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.signaler_annonce(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.signaler_annonce(UUID, TEXT, TEXT) TO authenticated;
