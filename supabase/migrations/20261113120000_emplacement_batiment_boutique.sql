-- Correction MANUELLE du placement du bâtiment d'une boutique (carte 3D « Autour de moi », lot 2.3 de l'étape 2).
--
-- La carte pose le bâtiment de chaque boutique près de sa position, aligné sur la rue. Si la position est approximative, le propriétaire de la boutique (ou un administrateur)
-- peut REPOSER le bâtiment ailleurs : on enregistre un point de remplacement, à 150 m au plus de la vraie position de la boutique. La vraie position de la boutique
-- (marketplace_stores.latitude / longitude) n'est JAMAIS modifiée : on masque, on ne supprime ni n'écrase jamais de données. « Rétablir » supprime seulement le point de remplacement.
--
-- Même mécanique que signaler_message (20261018220000) : aucune écriture directe (invariant 1), tout passe par des fonctions SECURITY DEFINER qui revérifient elles-mêmes les droits
-- (propriétaire de la boutique ou administrateur). Lecture publique limitée aux colonnes d'affichage : l'auteur de la correction n'est jamais lisible par les clients.
--
-- RETOUR ARRIÈRE (non destructif, à ne lancer qu'avec un « go ») : ALTER TABLE public.marketplace_store_building_positions RENAME TO marketplace_store_building_positions_retiree;
-- puis supprimer les deux fonctions ; la carte retrouve alors la position réelle de chaque boutique (lecture défensive côté application).
-- NON APPLIQUÉE en production : à appliquer par fichier de migration commité, après un « go » explicite (jamais dans l'éditeur SQL du tableau de bord).

CREATE TABLE IF NOT EXISTS public.marketplace_store_building_positions (
  store_id    UUID PRIMARY KEY REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  latitude    DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude   DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  corrige_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_store_building_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lecture publique des emplacements de bâtiments" ON public.marketplace_store_building_positions;
CREATE POLICY "lecture publique des emplacements de bâtiments"
  ON public.marketplace_store_building_positions FOR SELECT
  TO anon, authenticated
  USING (true);

-- Aucune écriture directe ; lecture limitée aux colonnes d'affichage (jamais corrige_par).
REVOKE ALL ON TABLE public.marketplace_store_building_positions FROM PUBLIC, anon, authenticated;
GRANT SELECT (store_id, latitude, longitude) ON public.marketplace_store_building_positions TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.corriger_emplacement_batiment(p_store_id UUID, p_latitude DOUBLE PRECISION, p_longitude DOUBLE PRECISION)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi   UUID := auth.uid();
  v_owner UUID;
  v_lat   DOUBLE PRECISION;
  v_lng   DOUBLE PRECISION;
  v_dist  DOUBLE PRECISION;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise pour déplacer un bâtiment.';
  END IF;
  IF p_latitude IS NULL OR p_longitude IS NULL OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'Position invalide.';
  END IF;

  SELECT s.owner_id, s.latitude, s.longitude INTO v_owner, v_lat, v_lng
  FROM public.marketplace_stores s
  WHERE s.id = p_store_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Boutique introuvable.';
  END IF;
  IF v_owner IS DISTINCT FROM v_moi AND NOT public.is_admin(v_moi) THEN
    RAISE EXCEPTION 'Seul le propriétaire de la boutique ou un administrateur peut déplacer son bâtiment.';
  END IF;
  IF v_lat IS NULL OR v_lng IS NULL THEN
    RAISE EXCEPTION 'Cette boutique n''a pas de position.';
  END IF;

  -- le nouveau point reste près de la vraie position de la boutique (150 m au plus) : le bâtiment ne peut pas être envoyé à l'autre bout de la ville
  v_dist := sqrt(power((p_longitude - v_lng) * 111320 * cos(radians(v_lat)), 2) + power((p_latitude - v_lat) * 110574, 2));
  IF v_dist > 150 THEN
    RAISE EXCEPTION 'Le bâtiment doit rester à 150 m au plus de la position de la boutique.';
  END IF;

  INSERT INTO public.marketplace_store_building_positions (store_id, latitude, longitude, corrige_par, updated_at)
  VALUES (p_store_id, p_latitude, p_longitude, v_moi, now())
  ON CONFLICT (store_id) DO UPDATE
    SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, corrige_par = EXCLUDED.corrige_par, updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object('enregistre', true, 'distance_m', round(v_dist::numeric, 1));
END;
$$;

CREATE OR REPLACE FUNCTION public.retablir_emplacement_batiment(p_store_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi   UUID := auth.uid();
  v_owner UUID;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;
  SELECT s.owner_id INTO v_owner FROM public.marketplace_stores s WHERE s.id = p_store_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Boutique introuvable.';
  END IF;
  IF v_owner IS DISTINCT FROM v_moi AND NOT public.is_admin(v_moi) THEN
    RAISE EXCEPTION 'Seul le propriétaire de la boutique ou un administrateur peut rétablir son bâtiment.';
  END IF;
  DELETE FROM public.marketplace_store_building_positions WHERE store_id = p_store_id;
  RETURN jsonb_build_object('retabli', true);
END;
$$;

REVOKE ALL ON FUNCTION public.corriger_emplacement_batiment(UUID, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.corriger_emplacement_batiment(UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
REVOKE ALL ON FUNCTION public.retablir_emplacement_batiment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retablir_emplacement_batiment(UUID) TO authenticated;
