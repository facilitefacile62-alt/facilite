-- =====================================================================
-- Favoris Marketplace : le cœur de la fiche article (maquette 16) et du
-- chat vendeur (maquette 36) ajoute ou retire un article de ses favoris.
--
-- Jusqu'ici ces cœurs ne gardaient leur état qu'en mémoire de l'écran
-- (rien n'était enregistré). La table n'existait pas.
--
-- Écriture : uniquement via basculer_favori_marketplace() (SECURITY
-- DEFINER, invariant 1 : aucun droit INSERT/UPDATE/DELETE direct pour
-- authenticated). Lecture : chacun ne voit que ses propres favoris.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.marketplace_favoris (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.marketplace_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS marketplace_favoris_product_idx
  ON public.marketplace_favoris (product_id);

ALTER TABLE public.marketplace_favoris ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "favoris lisibles par leur propriétaire" ON public.marketplace_favoris;
CREATE POLICY "favoris lisibles par leur propriétaire"
  ON public.marketplace_favoris FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.marketplace_favoris FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.marketplace_favoris TO authenticated;

-- Ajoute l'article aux favoris s'il n'y est pas, l'en retire sinon.
-- Renvoie l'état final : true = en favori.
CREATE OR REPLACE FUNCTION public.basculer_favori_marketplace(p_item_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.marketplace_items WHERE id = p_item_id) THEN
    RAISE EXCEPTION 'Article introuvable';
  END IF;

  DELETE FROM public.marketplace_favoris WHERE user_id = v_moi AND product_id = p_item_id;
  IF FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.marketplace_favoris (user_id, product_id) VALUES (v_moi, p_item_id);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.basculer_favori_marketplace(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.basculer_favori_marketplace(UUID) TO authenticated;
