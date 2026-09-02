-- Signaler une annonce.
--
-- La Marketplace ouvre la publication à n'importe quel compte : personne ne
-- relit une annonce avant qu'elle n'apparaisse. La RLS empêche un vendeur de
-- toucher au stock d'un autre, elle n'empêche pas de publier une contrefaçon,
-- un prix mensonger ou un article qui n'existe pas. Sans voie de recours, le
-- seul recours d'un acheteur trompé est de quitter le service.
--
-- Ce que cette migration installe est délibérément modeste : une table, une
-- fonction d'écriture, une notification aux administrateurs. Pas de retrait
-- automatique au bout de N signalements — un concurrent peut signaler en
-- boucle, et une annonce honnête disparaîtrait sans que personne n'ait
-- regardé. La décision reste humaine.

CREATE TABLE IF NOT EXISTS public.marketplace_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     UUID NOT NULL REFERENCES public.marketplace_items(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  motif       TEXT NOT NULL CHECK (motif IN (
                'inexistant', 'prix_trompeur', 'contrefacon', 'interdit', 'autre'
              )),
  details     TEXT,
  statut      TEXT NOT NULL DEFAULT 'nouveau' CHECK (statut IN ('nouveau', 'traite', 'rejete')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Un signalement par personne et par annonce : sans cette contrainte, un
  -- seul compte pourrait gonfler artificiellement le compteur et faire passer
  -- une annonce concurrente pour un problème massif.
  UNIQUE (item_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_reports_item ON public.marketplace_reports (item_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_reports_statut ON public.marketplace_reports (statut, created_at DESC);

ALTER TABLE public.marketplace_reports ENABLE ROW LEVEL SECURITY;

-- Lecture réservée aux administrateurs. Un signalement contient l'identité de
-- la personne qui l'a émis : le vendeur visé ne doit jamais pouvoir la lire,
-- sous peine de représailles hors de l'application.
-- DROP avant CREATE : CREATE POLICY n'a pas de forme IF NOT EXISTS, et une
-- migration qui ne se rejoue pas empêche de reconstruire une base de test à
-- partir du dossier migrations.
DROP POLICY IF EXISTS "un admin lit les signalements" ON public.marketplace_reports;
CREATE POLICY "un admin lit les signalements"
  ON public.marketplace_reports FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Aucune policy d'écriture : tout passe par signaler_annonce ci-dessous, et
-- aucun GRANT INSERT/UPDATE/DELETE n'est accordé (invariant 1).
GRANT SELECT ON public.marketplace_reports TO authenticated;

-- Nouveau type de notification, pour que les signalements ne se mélangent pas
-- aux escalades du support dans le fil de l'administrateur.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'jobs', 'posts', 'mentions', 'candidature', 'reponse',
    'badge', 'message', 'system', 'document_access', 'document_delivery',
    'support_escalade', 'marketplace_signalement'
  ]));

-- ---------------------------------------------------------------------------
-- Signaler une annonce
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
  -- Signaler sa propre annonce n'a aucun sens et pollue la file : le vendeur
  -- peut la retirer lui-même en un clic.
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
  -- xmax vaut 0 sur une insertion réelle, autre chose quand ON CONFLICT a
  -- basculé en UPDATE. Sans cette distinction, quelqu'un qui reformule son
  -- signalement renotifierait tous les administrateurs : la ligne n'est pas
  -- ajoutée, donc le compteur reste à 1, donc la condition se redéclenche.
  RETURNING (xmax = 0) INTO v_nouveau;

  SELECT count(*)::int INTO v_total
  FROM public.marketplace_reports WHERE item_id = p_item_id;

  -- Les administrateurs sont prévenus au tout premier signalement seulement.
  -- Au delà, une annonce très signalée noierait leur fil sous des doublons ;
  -- le compteur figure dans le message et dans la table.
  IF v_nouveau AND v_total = 1 THEN
    FOR v_admin IN
      SELECT ur.user_id FROM public.user_roles ur
      WHERE ur.role = 'admin' AND ur.status = 'active'
    LOOP
      INSERT INTO public.notifications (user_id, actor_id, type, content, link)
      VALUES (
        v_admin.user_id, v_moi, 'marketplace_signalement',
        'Annonce signalée : ' || left(v_titre, 80),
        '/admin'
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object('enregistre', true, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.signaler_annonce(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.signaler_annonce(UUID, TEXT, TEXT) TO authenticated;
